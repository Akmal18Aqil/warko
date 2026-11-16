import type { StaffRole } from "@wakro/shared";
import { decodeId } from "../guards";
import { HttpError, json, readJsonObject } from "../http";
import { get, send, type AuthedContext, type Route } from "../router";

type ResourceSpec = {
  name: string;
  readRoles: readonly StaffRole[];
  writeRoles: readonly StaffRole[];
  /** Builds the whole list response, so a resource can add paging or filters. */
  list(context: AuthedContext): Promise<Response>;
  /** Single-item lookup; omit when the list is small enough for the client to filter. */
  find?(context: AuthedContext, id: string): Promise<unknown | null>;
  upsert(context: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown>;
  remove(context: AuthedContext, id: string): Promise<void>;
};

/** `/api/resources/<name>` CRUD routes: GET list, GET one (optional), PUT upsert, DELETE. */
export function resourceRoutes(spec: ResourceSpec): Route[] {
  const base = `/api/resources/${spec.name}`;
  const routes: Route[] = [
    get(base, spec.readRoles, spec.list),
    send("PUT", `${base}/:id`, spec.writeRoles, async (context) => {
      const id = decodeId(context.params.id);
      return json({ data: await spec.upsert(context, id, await readJsonObject(context.request)) });
    }),
    send("DELETE", `${base}/:id`, spec.writeRoles, async (context) => {
      await spec.remove(context, decodeId(context.params.id));
      return json({ data: true });
    }),
  ];
  const { find } = spec;
  if (find) {
    routes.push(
      get(`${base}/:id`, spec.readRoles, async (context) => {
        const item = await find(context, decodeId(context.params.id));
        if (item === null) throw new HttpError(404, "Data tidak ditemukan.");
        return json({ data: item });
      }),
    );
  }
  return routes;
}
