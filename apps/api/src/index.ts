import { purgeExpired } from "./auth";
import type { Env } from "./env";
import { errorResponse, HttpError, json } from "./http";
import { createRouter } from "./router";
import { routes } from "./routes";

const dispatch = createRouter(routes);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      return await dispatch(request, env, url);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      console.error("Worker API error", error);
      return json({ message: "Terjadi kesalahan pada server." }, 500);
    }
  },

  /** Daily cron (see `triggers.crons` in wrangler.jsonc): drops expired sessions and login counters. */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeExpired(env));
  },
} satisfies ExportedHandler<Env>;
