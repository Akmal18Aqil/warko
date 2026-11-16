import { handleAuth } from "./auth-routes";
import { handleResources } from "./resource-routes";
import { handleDomain } from "./domain-routes";
import { handlePayments } from "./payments";
import type { Env } from "./env";
import { errorResponse, HttpError, json } from "./http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      return (await handleAuth(request, env, url))
        ?? (await handleDomain(request, env, url))
        ?? (await handlePayments(request, env, url))
        ?? (await handleResources(request, env, url))
        ?? json({ message: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      console.error("Worker API error", error);
      return json({ message: "Terjadi kesalahan pada server." }, 500);
    }
  },
};
