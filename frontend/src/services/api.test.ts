import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ApiError, apiFetch, apiJson } from "./api";

function mockHttp(
  status: number,
  payload: unknown = {},
  headers: Record<string, string> = {},
) {
  const response = new Response(
    status === 204 ? null : JSON.stringify(payload),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    },
  );

  vi.mocked(fetch).mockResolvedValue(response);
}

describe("Shared API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses successful JSON", async () => {
    mockHttp(200, { status: "ok" });

    const result = await apiJson<{ status: string }>(
      "/health",
    );

    expect(result).toEqual({ status: "ok" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("handles HTTP 204 without JSON", async () => {
    mockHttp(204);

    const result = await apiJson<void>(
      "/datasets/example",
      { method: "DELETE" },
    );

    expect(result).toBeUndefined();
  });

  it("preserves request options", async () => {
    mockHttp(200, { ok: true });

    const options: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 42 }),
    };

    await apiJson("/analysis", options);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/analysis"),
      options,
    );
  });

  it("handles HTTP 413 with detail", async () => {
    mockHttp(413, {
      detail: "CSV exceeds the 10 MB upload limit.",
    });

    await expect(
      apiFetch("/datasets"),
    ).rejects.toMatchObject({
      status: 413,
      message: expect.stringContaining("10 MB"),
    });
  });

  it("handles HTTP 413 without detail", async () => {
    mockHttp(413);

    await expect(
      apiFetch("/datasets"),
    ).rejects.toThrow("Request too large");
  });

  it("reads Retry-After on HTTP 429", async () => {
    mockHttp(
      429,
      { detail: "Rate limit exceeded." },
      { "Retry-After": "18" },
    );

    try {
      await apiFetch("/analysis");
      throw new Error("Expected API error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 429,
        retryAfterSeconds: 18,
      });
      expect((error as ApiError).message)
        .toContain("18 seconds");
    }
  });

  it("handles missing Retry-After", async () => {
    mockHttp(429);

    await expect(
      apiFetch("/analysis"),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: null,
    });
  });

  it("ignores invalid Retry-After", async () => {
    mockHttp(429, {}, { "Retry-After": "invalid" });

    await expect(
      apiFetch("/analysis"),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: null,
    });
  });

  it("extracts FastAPI validation messages", async () => {
    mockHttp(422, {
      detail: [
        { msg: "Field required" },
        { msg: "Invalid value" },
      ],
    });

    await expect(
      apiFetch("/analysis"),
    ).rejects.toThrow(
      "Field required; Invalid value",
    );
  });

  it("handles HTTP 503 with detail", async () => {
    mockHttp(503, {
      detail: "Stored dataset could not be read.",
    });

    await expect(
      apiFetch("/datasets/example/preview"),
    ).rejects.toThrow(
      "Stored dataset could not be read",
    );
  });

  it("handles HTTP 503 without detail", async () => {
    mockHttp(503);

    await expect(
      apiFetch("/analysis"),
    ).rejects.toThrow("Service unavailable");
  });

  it.each([502, 504])(
    "handles gateway error %s",
    async (status) => {
      mockHttp(status);

      await expect(
        apiFetch("/chat/ask"),
      ).rejects.toMatchObject({
        status,
        message: expect.stringContaining(
          "backend or AI service",
        ),
      });
    },
  );

  it("hides internal HTTP 500 detail", async () => {
    mockHttp(500, {
      detail: "Private database connection information",
    });

    try {
      await apiFetch("/datasets");
      throw new Error("Expected API error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);

      const message = (error as ApiError).message;

      expect(message).toContain("backend error");
      expect(message).not.toContain(
        "Private database connection",
      );
    }
  });

  it("preserves HTTP 404 detail", async () => {
    mockHttp(404, {
      detail: "Dataset not found.",
    });

    await expect(
      apiFetch("/datasets/missing"),
    ).rejects.toMatchObject({
      status: 404,
      message: "Dataset not found.",
    });
  });

  it("handles non-JSON server errors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>Error</html>", {
        status: 503,
        headers: {
          "Content-Type": "text/html",
        },
      }),
    );

    await expect(
      apiFetch("/analysis"),
    ).rejects.toThrow("Service unavailable");
  });

  it("handles backend connection failures", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await expect(
      apiFetch("/datasets"),
    ).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining(
        "Cannot connect to the local backend",
      ),
    });
  });

  it("preserves request cancellation", async () => {
    const abortError = new Error("Request aborted");
    abortError.name = "AbortError";

    vi.mocked(fetch).mockRejectedValue(abortError);

    await expect(
      apiFetch("/chat/ask", {
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(abortError);
  });
});
