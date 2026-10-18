/**
 * Route handler helpers: uniform JSON envelope, error mapping, validation.
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "./errors";

export type Ctx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };

export function ok<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return fail(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return fail(400, "validation", "הנתונים שנשלחו אינם תקינים", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (err instanceof SyntaxError) return fail(400, "bad_json", "גוף הבקשה אינו JSON תקין");
  console.error("[api] unhandled", err);
  return fail(500, "internal", "אירעה שגיאה. נסו שוב בעוד רגע.");
}

type Handler<P extends Record<string, string>> = (req: Request, ctx: Ctx<P>) => Promise<Response>;

/** Wraps a handler so thrown errors become JSON responses. */
export function route<P extends Record<string, string> = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => {
    throw new SyntaxError("bad json");
  });
  return schema.parse(json);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  return schema.parse(obj);
}
