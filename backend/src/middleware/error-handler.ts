import { Request, Response, NextFunction } from "express";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers already sent, delegate to default express handler
  if (res.headersSent) {
    return _next(err);
  }

  // Handle known Bedrock and integration errors
  if (err instanceof BedrockIntegrationError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
    return;
  }

  // Generic internal server error: hide stack trace and credentials
  console.error("[ServerError]", err.message, err.stack);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An internal server error occurred",
    },
  });
}
