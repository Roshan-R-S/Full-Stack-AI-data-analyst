import re

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

TRUSTED_HOST = re.compile(
    r"^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$",
    re.IGNORECASE,
)

ALLOWED_ORIGINS = frozenset({
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
})

WRITE_METHODS = frozenset({
    "POST", "PUT", "PATCH", "DELETE",
})


def is_trusted_host(request: Request) -> bool:
    hosts = request.headers.getlist("host")

    if len(hosts) != 1:
        return False

    host = hosts[0].strip()

    if TRUSTED_HOST.fullmatch(host):
        return True

    # FastAPI TestClient uses a synthetic ASGI client
    # named "testclient" and Host "testserver".
    # Never allow "testserver" for real network clients.
    return (
        host == "testserver"
        and request.client is not None
        and request.client.host == "testclient"
    )


def is_allowed_write(request: Request) -> bool:
    if request.method not in WRITE_METHODS:
        return True

    # Browser fetch metadata provides additional CSRF
    # protection when available.
    if request.headers.get("sec-fetch-site") == "cross-site":
        return False

    origin = request.headers.get("origin")

    # Local CLI tools may omit Origin. This is not
    # authentication: local processes remain trusted.
    if origin is None:
        return True

    return origin in ALLOWED_ORIGINS


async def local_security_middleware(
    request: Request,
    call_next: RequestResponseEndpoint,
) -> Response:
    if not is_trusted_host(request):
        response = JSONResponse(
            status_code=400,
            content={"detail": "Untrusted HTTP host."},
        )

    elif not is_allowed_write(request):
        response = JSONResponse(
            status_code=403,
            content={"detail": "Cross-origin request blocked."},
        )

    else:
        response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"

    return response