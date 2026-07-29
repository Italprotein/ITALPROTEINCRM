import { captureError } from "@/lib/backend/observability";

/*
 * Next.js instrumentation. `onRequestError` fires for every unhandled server
 * error — pages, route handlers and server actions alike — which is the single
 * place that turns a silent 500 into something searchable in the container logs.
 */

export function register(): void {
  // Nothing to initialise yet. A hosted APM's init() would go here.
}

export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): void {
  captureError(error, {
    source: `${request.method ?? "?"} ${request.path ?? context.routePath ?? "?"}`,
    extra: {
      routerKind: context.routerKind,
      routeType: context.routeType,
      routePath: context.routePath,
    },
  });
}
