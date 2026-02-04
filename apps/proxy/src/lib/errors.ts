import type { Context } from "hono";
import type { ErrorResponse } from "@hyghertales/shared";
import { errorResponseSchema } from "@hyghertales/shared";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

export function errorResponse(
  c: Context,
  code: string,
  message: string,
  status: number = 500,
  details?: unknown
) {
  const body: ErrorResponse = {
    code,
    message,
    ...(details !== undefined && { details }),
  };
  const parsed = errorResponseSchema.parse(body);
  type HttpStatus = 400 | 404 | 500;
  return c.json(parsed, status as HttpStatus);
}
