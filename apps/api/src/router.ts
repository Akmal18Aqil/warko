import type { StaffRole } from "@wakro/shared";
import { requireSession } from "./auth";
import type { Env, SessionStaff } from "./env";
import { assertSameOrigin, requireRole } from "./guards";
import { HttpError, json } from "./http";

export type RouteContext = {
  request: Request;
  env: Env;
  url: URL;
  /** Values of the `:name` segments of the matched pattern (still URL-encoded). */
  params: Record<string, string>;
};

export type AuthedContext = RouteContext & { staff: SessionStaff };

type RouteBase = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** `/api/orders/:no(\d{1,15})/status`: `:name` matches one segment, an optional `(regex)` narrows it. */
  pattern: string;
  /** Same-origin check for cookie-authenticated, state-changing requests. */
  csrf: boolean;
};

export type Route =
  | (RouteBase & { roles: null; handler: (context: RouteContext) => Promise<Response> })
  | (RouteBase & { roles: readonly StaffRole[]; handler: (context: AuthedContext) => Promise<Response> });

type CompiledRoute = { route: Route; regex: RegExp; names: string[] };

const PARAM_SEGMENT = /^:(\w+)(?:\((.+)\))?$/;

function compile(route: Route): CompiledRoute {
  const names: string[] = [];
  const source = route.pattern
    .split("/")
    .map((segment) => {
      const param = PARAM_SEGMENT.exec(segment);
      if (!param) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(param[1]);
      return `(${param[2] ?? "[^/]+"})`;
    })
    .join("/");
  return { route, regex: new RegExp(`^${source}$`), names };
}

export function get(pattern: string, roles: readonly StaffRole[], handler: (c: AuthedContext) => Promise<Response>): Route {
  return { method: "GET", pattern, roles, csrf: false, handler };
}

export function send(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  pattern: string,
  roles: readonly StaffRole[],
  handler: (c: AuthedContext) => Promise<Response>,
): Route {
  return { method, pattern, roles, csrf: true, handler };
}

export function publicGet(pattern: string, handler: (c: RouteContext) => Promise<Response>): Route {
  return { method: "GET", pattern, roles: null, csrf: false, handler };
}

/** `csrf: false` is only for server-to-server callbacks that carry their own signature. */
export function publicPost(pattern: string, handler: (c: RouteContext) => Promise<Response>, csrf = true): Route {
  return { method: "POST", pattern, roles: null, csrf, handler };
}

export function createRouter(routes: readonly Route[]) {
  const compiled = routes.map(compile);

  return async function dispatch(request: Request, env: Env, url: URL): Promise<Response> {
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    const allowed = new Set<string>();
    for (const { route, regex, names } of compiled) {
      const match = regex.exec(path);
      if (!match) continue;
      allowed.add(route.method);
      if (route.method !== request.method) continue;

      const params = Object.fromEntries(names.map((name, i) => [name, match[i + 1]]));
      const context: RouteContext = { request, env, url, params };
      if (route.csrf) assertSameOrigin(request, url);
      if (route.roles === null) return route.handler(context);
      const staff = await requireSession(env, request, url);
      requireRole(staff, ...route.roles);
      return route.handler({ ...context, staff });
    }
    if (allowed.size > 0) {
      throw new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: [...allowed].join(", ") });
    }
    return json({ message: "Endpoint tidak ditemukan." }, 404);
  };
}
