const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (!("detail" in payload)) {
    return null;
  }

  const detail = payload.detail;

  if (typeof detail === "string") {
    return detail.trim() || null;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .filter(
        (item: unknown) =>
          item !== null &&
          typeof item === "object" &&
          "msg" in item &&
          typeof item.msg === "string",
      )
      .map((item) => String(item.msg))
      .slice(0, 3);

    return messages.length ? messages.join("; ") : null;
  }

  return null;
}

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");

  if (!raw || !/^\d+$/.test(raw.trim())) {
    return null;
  }

  const seconds = Number(raw);

  return Number.isSafeInteger(seconds) && seconds >= 0
    ? seconds
    : null;
}

async function buildApiError(
  response: Response,
): Promise<ApiError> {
  let detail: string | null = null;

  try {
    const payload: unknown = await response.json();
    detail = errorDetail(payload);
  } catch {
    // A proxy or failed server may send a non-JSON response.
  }

  const status = response.status;
  const retry = retryAfterSeconds(response);

  if (status === 413) {
    return new ApiError(
      detail
        ? `Request too large. ${detail}`
        : "Request too large. Reduce the file or request size.",
      status,
    );
  }

  if (status === 429) {
    const guidance = retry !== null
      ? ` Try again in ${retry} seconds.`
      : " Please wait before trying again.";

    return new ApiError(
      `Request limit reached.${guidance}`,
      status,
      retry,
    );
  }

  if (status === 503) {
    return new ApiError(
      detail
        ? `Service unavailable. ${detail}`
        : "Service unavailable. Check the local backend and try again.",
      status,
    );
  }

  if (status === 502 || status === 504) {
    return new ApiError(
      detail
        ? `Service error. ${detail}`
        : "The backend or AI service could not complete this request.",
      status,
    );
  }

  if (status === 500) {
    return new ApiError(
      "A backend error occurred. Check the FastAPI terminal.",
      status,
    );
  }

  return new ApiError(
    detail ?? `Request failed (HTTP ${status}).`,
    status,
  );
}

export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, options);
  } catch (error) {
    // Cancellation is intentional. Preserve AbortError so
    // chat cancellation works as before.
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      "Cannot connect to the local backend. " +
      "Check that FastAPI is running on 127.0.0.1:8000.",
      0,
    );
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response;
}

export async function apiJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}