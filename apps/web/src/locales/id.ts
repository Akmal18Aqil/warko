import { app } from "./sections/app";
import { cashDrawer } from "./sections/cashDrawer";
import { common } from "./sections/common";
import { kitchen } from "./sections/kitchen";
import { network } from "./sections/network";
import { orders } from "./sections/orders";
import { pos } from "./sections/pos";
import { printing } from "./sections/printing";
import { products } from "./sections/products";
import { reports } from "./sections/reports";
import { scanner } from "./sections/scanner";
import { selfOrder } from "./sections/selfOrder";
import { settings } from "./sections/settings";
import { state } from "./sections/state";
import { tables } from "./sections/tables";
import { waiter } from "./sections/waiter";

/** All user-facing text of the app (Indonesian), grouped by feature. */
export const t = {
  common,
  app,
  state,
  printing,
  pos,
  orders,
  tables,
  products,
  reports,
  settings,
  kitchen,
  waiter,
  selfOrder,
  cashDrawer,
  scanner,
  network,
} as const;
