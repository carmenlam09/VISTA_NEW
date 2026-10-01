import { ApiError as GeminiApiError } from "@google/genai";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/errors";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // lib/gemini.ts already fails over across every configured GEMINI_API_KEYS
  // entry on a 429, so reaching this point means all of them are currently
  // quota-exhausted - a real "come back later" case, not a transient blip,
  // worth telling the reviewer explicitly instead of a generic 500.
  if (err instanceof GeminiApiError && err.status === 429) {
    console.error(err);
    res.status(503).json({
      error:
        "Gemini is rate-limiting this request - every configured API key is over quota right now. Wait a minute and try again, or check the Gemini API plan/billing for these keys.",
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
