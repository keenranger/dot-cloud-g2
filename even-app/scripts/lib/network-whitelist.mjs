import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

export function assertWhitelistedUrls(source, whitelist, filename) {
  const allowed = new Set(whitelist.map((value) => new URL(value).origin));
  // Require an ASCII hostname: prose such as "https://로" is not a URL reference.
  // Accept JS-escaped slashes and skip userinfo so "https://allowed@other" resolves to "other".
  const urls =
    source.match(
      /\b(?:https?|wss?):(?:\\?\/){2}(?:[^\s/@"'<>`\\]*@)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?(?:\\?\/[^\s"'<>`)]*)?/gi,
    ) || [];
  for (const value of urls) {
    const origin = new URL(value.replaceAll("\\/", "/")).origin;
    if (!allowed.has(origin)) throw new Error(`URL outside network.whitelist in ${filename}: ${origin}`);
  }
}

// Text code/UI formats only: license notices and binary assets (WASM, models) are not scanned.
const SCANNED_EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".cjs", ".css", ".json", ".webmanifest", ".svg"]);

export async function verifyBundleNetwork(root, whitelist) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await verifyBundleNetwork(path, whitelist);
    else if (SCANNED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      assertWhitelistedUrls(await readFile(path, "utf8"), whitelist, path);
    }
  }
}
