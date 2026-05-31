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

// Load-bearing cross-peer assertion of the advertised core claim: "viral
// chain-invite — see who brought who as a growing snowball graph." The
// existing test above only clicks the `testInvite` STUB button, which never
// touches the REAL viral path: the on-mount effect that reads `#inviter=<id>`
// from the URL hash and records `inviter -> me`. This test exercises that real
// path: peer B *joins via A's invite link* (`baseURL#inviter=<A.peerId>`), and
// we assert the snowball graph shows A -> B AND the invite count grows on BOTH
// screens — proving the chain propagates peer -> peer.
test("B joins via A's invite link → snowball shows A→B and count grows on both peers", async ({
  browser,
  baseURL,
}) => {
  // Open A first so we can read its peerId and build the invite link, then
  // open B *at that link* (this drives the real `#inviter=` mount effect).
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");

    // A's own peerId is rendered onto the root element (data-peer-id). This is
    // exactly the id A's "share the room" button bakes into `#inviter=<id>`.
    const aPeerId = await a.locator(".snow-screen").getAttribute("data-peer-id");
    if (!aPeerId) throw new Error("could not read peer A's id");

    // Before anyone is invited, both peers show zero invites.
    await expect(a.locator(".snow-status")).toContainText("0 invites");
    await expect(b.locator(".snow-status")).toContainText("0 invites");

    // B follows A's invite LINK — the real viral entry point. Navigating B to
    // `#inviter=<A.peerId>` triggers the on-mount effect that records A -> B
    // into the shared `invites` edge set (no stub button involved).
    const inviteUrl = `${baseURL ?? ""}#inviter=${encodeURIComponent(aPeerId)}`;
    await b.goto(inviteUrl);
    await b.getByPlaceholder("your name").fill("bob");

    // The A -> B edge must propagate across the mesh and the count must grow on
    // BOTH screens (1 invite each). A "snowball" that only grew on the joiner's
    // own screen would not be a shared, viral graph.
    await expect(a.locator(".snow-status")).toContainText("1 invites");
    await expect(b.locator(".snow-status")).toContainText("1 invites");

    // The snowball graph on BOTH peers shows the chain rooted at alice with bob
    // as her direct invitee — "see who brought who".
    for (const page of [a, b]) {
      const root = page.locator(".snow-graph > ul > .snow-node");
      await expect(root.locator("> .snow-name")).toContainText("alice");
      await expect(root.locator(".snow-children > .snow-node > .snow-name")).toContainText("bob");
    }

    // Arrivals feed records bob arriving "via alice" on both screens.
    await expect(a.locator(".snow-arrivals")).toContainText("via alice");
    await expect(b.locator(".snow-arrivals")).toContainText("via alice");
  } finally {
    await cleanup();
  }
});
