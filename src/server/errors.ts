/** Application errors mapped to HTTP responses by the API layer. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = "נדרשת התחברות") =>
  new AppError(401, "unauthorized", message);
export const forbidden = (message = "אין לך הרשאה לפעולה זו") =>
  new AppError(403, "forbidden", message);
export const notFound = (message = "לא נמצא") => new AppError(404, "not_found", message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const tooMany = (message = "יותר מדי בקשות, נסו שוב בעוד רגע") =>
  new AppError(429, "rate_limited", message);
