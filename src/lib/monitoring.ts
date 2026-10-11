type MonitoringContext = {
  operation: string;
  route?: string;
  requestId?: string;
};

/** Emit structured server logs without serializing request data or error messages. */
export function logServerError(
  context: MonitoringContext,
  error: unknown,
): void {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error(
    JSON.stringify({
      level: "error",
      event: "keeper.server_error",
      operation: context.operation,
      route: context.route,
      requestId: context.requestId,
      errorType,
      timestamp: new Date().toISOString(),
    }),
  );
}
