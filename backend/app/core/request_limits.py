from collections import defaultdict, deque
from collections.abc import Callable, Mapping
from math import ceil
from threading import Lock
from time import monotonic

from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

JSON_BODY_LIMIT = 64 * 1024
UPLOAD_BODY_LIMIT = 12 * 1024 * 1024

REQUEST_LIMITS = {
    "gemini": 12,
    "analysis": 60,
    "export": 30,
    "saved-run": 30,
    "upload": 12,
}


class SlidingWindowLimiter:
    def __init__(
        self,
        limits: Mapping[str, int],
        window_seconds: float = 60,
        clock: Callable[[], float] = monotonic,
    ):
        self.limits = dict(limits)
        self.window_seconds = window_seconds
        self.clock = clock
        self.events: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def check(self, bucket: str) -> int | None:
        with self.lock:
            now = self.clock()
            events = self.events[bucket]

            while (
                events
                and now - events[0] >= self.window_seconds
            ):
                events.popleft()

            if len(events) >= self.limits[bucket]:
                return max(
                    1,
                    ceil(self.window_seconds - (now - events[0])),
                )

            events.append(now)
            return None


def request_bucket(method: str, path: str) -> str | None:
    if method != "POST":
        return None

    if path == "/api/v1/chat/ask":
        return "gemini"

    if path == "/api/v1/analysis":
        return "analysis"

    if path.startswith("/api/v1/exports/analysis/"):
        return "export"

    if path == "/api/v1/datasets":
        return "upload"

    if (
        path.startswith("/api/v1/saved-analyses/")
        and path.endswith("/run")
    ):
        return "saved-run"

    return None


class LocalRequestGuard:
    def __init__(
        self,
        app: ASGIApp,
        limiter: SlidingWindowLimiter | None = None,
    ):
        self.app = app
        self.limiter = (
            limiter
            if limiter is not None
            else SlidingWindowLimiter(REQUEST_LIMITS)
        )

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "GET")

        if (
            not path.startswith("/api/v1/")
            or method not in {"POST", "PUT", "PATCH"}
        ):
            await self.app(scope, receive, send)
            return

        bucket = request_bucket(method, path)

        if bucket is not None:
            retry_after = self.limiter.check(bucket)

            if retry_after is not None:
                response = JSONResponse(
                    status_code=429,
                    content={
                        "detail":
                            "Local request limit reached. "
                            "Wait before trying again."
                    },
                    headers={"Retry-After": str(retry_after)},
                )
                await response(scope, receive, send)
                return

        max_bytes = (
            UPLOAD_BODY_LIMIT
            if method == "POST" and path == "/api/v1/datasets"
            else JSON_BODY_LIMIT
        )

        headers = Headers(scope=scope)
        content_length = headers.get("content-length")

        if content_length is not None:
            try:
                declared_size = int(content_length)
            except ValueError:
                declared_size = -1

            if declared_size < 0:
                response = JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length."},
                )
                await response(scope, receive, send)
                return

            if declared_size > max_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )
                await response(scope, receive, send)
                return

        # Bound actual bytes, including chunked requests.
        body = bytearray()

        while True:
            message = await receive()

            if message["type"] == "http.disconnect":
                return

            if message["type"] != "http.request":
                continue

            chunk = message.get("body", b"")

            if len(body) + len(chunk) > max_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )
                await response(scope, receive, send)
                return

            body.extend(chunk)

            if not message.get("more_body", False):
                break

        forwarded = False

        async def replay_receive():
            nonlocal forwarded

            if not forwarded:
                forwarded = True
                return {
                    "type": "http.request",
                    "body": bytes(body),
                    "more_body": False,
                }

            return await receive()

        await self.app(scope, replay_receive, send)