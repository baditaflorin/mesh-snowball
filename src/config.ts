import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-snowball",
  description: "Viral chain-invite. See who brought who as a growing snowball graph.",
  accentHex: "#6effff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
