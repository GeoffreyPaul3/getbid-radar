/**
 * Error reporting boundary for GetBidRadar client runtime.
 * Catches unhandled exceptions from TanStack Router error boundaries and logs them.
 */

export type ErrorReportOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

export function reportRuntimeError(
  error: unknown,
  context: Record<string, unknown> = {},
  options?: ErrorReportOptions,
) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  const route = window.location.pathname;

  if (process.env["NODE_ENV"] !== "production") {
    console.error(`[GetBidRadar Runtime Error] [${route}]`, {
      message,
      error,
      context,
      options,
    });
  }
}
