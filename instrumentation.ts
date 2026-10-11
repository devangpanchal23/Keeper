import type { Instrumentation } from "next";
import { logServerError } from "./src/lib/monitoring";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  // Use route templates and omit request paths, query strings, headers, and bodies.
  logServerError(
    {
      operation: `next.${context.routeType}`,
      route: context.routePath,
    },
    error,
  );
};
