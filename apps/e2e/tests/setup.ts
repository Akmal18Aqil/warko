import { expect, test as setup } from "@playwright/test";
import { E2E } from "../env.mjs";

setup("create the first admin account", async ({ request, baseURL }) => {
  const response = await request.post("/api/setup/bootstrap", {
    headers: { Origin: baseURL ?? "", "X-Bootstrap-Secret": E2E.bootstrapSecret },
    data: E2E.admin,
  });
  // 409: already created by an earlier run against the same server.
  expect([201, 200, 409]).toContain(response.status());
});
