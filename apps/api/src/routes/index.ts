import type { Route } from "../router";
import { authRoutes } from "./auth";
import { bootstrapRoutes } from "./bootstrap";
import { cashRoutes } from "./cash";
import { catalogRoutes } from "./catalog";
import { orderRoutes } from "./orders";
import { pinRoutes } from "./pin";
import { paymentRoutes } from "./payments";
import { publicRoutes } from "./public";

/** The single route table of the API. */
export const routes: Route[] = [
  ...authRoutes,
  ...pinRoutes,
  ...bootstrapRoutes,
  ...catalogRoutes,
  ...orderRoutes,
  ...cashRoutes,
  ...publicRoutes,
  ...paymentRoutes,
];
