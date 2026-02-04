import type { z } from "@hyghertales/shared";
import {
  healthResponseSchema,
  modSearchResponseSchema,
  errorResponseSchema,
  type ModSearchRequest,
  type ModSearchResponse,
  type ErrorResponse,
} from "@hyghertales/shared";

type ZodSchema<T> = z.ZodType<T>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ErrorResponse
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch JSON and validate with zod. Throws ApiError on non-2xx or validation failure.
 */
async function fetchJson<T>(
  baseUrl: string,
  path: string,
  schema: ZodSchema<T>,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json()) as unknown;

  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(data);
    const body = parsed.success ? parsed.data : undefined;
    throw new ApiError(
      body?.message ?? `Request failed: ${res.status}`,
      res.status,
      body
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError("Invalid response from server", res.status);
  }
  return parsed.data;
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    await fetchJson(baseUrl, "/health", healthResponseSchema);
    return true;
  } catch {
    return false;
  }
}

export async function searchMods(
  baseUrl: string,
  params: ModSearchRequest
): Promise<ModSearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.q,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return fetchJson<ModSearchResponse>(
    baseUrl,
    `/v1/search?${searchParams.toString()}`,
    modSearchResponseSchema
  );
}
