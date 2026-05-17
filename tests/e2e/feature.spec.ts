import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("alice test-invites bob → both peers see edge alice→bob in graph", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "test-invite bob", exact: true }).click();
    await b.waitForTimeout(400);

    await expect(b.locator(".snow-graph")).toContainText("alice");
    await expect(b.locator(".snow-graph")).toContainText("bob");
    await expect(b.locator(".snow-arrivals")).toContainText("via alice");
  } finally {
    await cleanup();
  }
});
