import { verifyWakeAssets } from "./lib/wake-assets.mjs";
await verifyWakeAssets(new URL("../public/wake-assets/", import.meta.url).pathname);
console.log("All pinned wake assets verified");
