import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertWhitelistedUrls, verifyBundleNetwork } from "./lib/network-whitelist.mjs";

const whitelist = ["https://relay.example", "wss://stt-rt.soniox.com"];
test("rejects undeclared URLs, including placeholder attributes", () => {
  assert.throws(
    () => assertWhitelistedUrls('<input placeholder="https://your-site.example">', whitelist, "index.html"),
    /outside network.whitelist/,
  );
  assert.throws(
    () => assertWhitelistedUrls('fetch("https://relay.example.evil.test/api")', whitelist, "app.js"),
    /outside network.whitelist/,
  );
  // Credentials before "@" do not change the destination host.
  assert.throws(
    () => assertWhitelistedUrls('fetch("https://relay.example@undeclared.example/api")', whitelist, "app.js"),
    /outside network.whitelist in app.js: https:\/\/undeclared.example/,
  );
  assert.throws(
    () => assertWhitelistedUrls('"https:\\/\\/undeclared.example\\/api"', whitelist, "app.js"),
    /outside network.whitelist in app.js: https:\/\/undeclared.example/,
  );
});
test("allows declared origins and ignores incomplete HTTPS instructions", () => {
  assert.doesNotThrow(() =>
    assertWhitelistedUrls(
      'https://relay.example/api wss://stt-rt.soniox.com/transcribe-websocket "wss:\\/\\/stt-rt.soniox.com\\/x" https://로 https://.',
      whitelist,
      "app.js",
    ),
  );
});

test("checks nested bundle assets while preserving license notices", async () => {
  const root = await mkdtemp(join(tmpdir(), "dots-network-"));
  try {
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "THIRD-PARTY-NOTICES.txt"), "https://license.example");
    await writeFile(join(root, "index.html"), '<a href="https://relay.example/setup">Setup</a>');
    await verifyBundleNetwork(root, whitelist);
    await writeFile(join(root, "assets", "app.js"), 'fetch("https://undeclared.example/api")');
    await assert.rejects(verifyBundleNetwork(root, whitelist), /outside network.whitelist.*app.js/);
    await rm(join(root, "assets", "app.js"));
    await writeFile(join(root, "assets", "site.WEBMANIFEST"), '{"start_url":"https://undeclared.example/"}');
    await assert.rejects(verifyBundleNetwork(root, whitelist), /outside network.whitelist.*site.WEBMANIFEST/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("manifest fails closed and removes a stale app.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "dots-manifest-"));
  const scripts = fileURLToPath(new URL("./", import.meta.url));
  const run = () =>
    spawnSync(process.execPath, [join(root, "scripts", "manifest.mjs")], {
      env: { RELAY_ORIGIN: "https://relay.example" },
      encoding: "utf8",
    });
  try {
    await mkdir(join(root, "scripts", "lib"), { recursive: true });
    await mkdir(join(root, "dist"));
    await copyFile(join(scripts, "manifest.mjs"), join(root, "scripts", "manifest.mjs"));
    await copyFile(
      join(scripts, "lib", "network-whitelist.mjs"),
      join(root, "scripts", "lib", "network-whitelist.mjs"),
    );
    await writeFile(join(root, "app.json"), "stale");
    await writeFile(join(root, "dist", "index.html"), '<a href="https://undeclared.example">Help</a>');
    const failed = run();
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /outside network.whitelist/);
    await assert.rejects(stat(join(root, "app.json")), { code: "ENOENT" });

    // Only the project's own GitHub pages are linked; other GitHub hosts stay undeclared.
    await writeFile(join(root, "dist", "index.html"), '<a href="https://api.github.com/repos">API</a>');
    assert.match(run().stderr, /outside network.whitelist.*https:\/\/api\.github\.com/);

    await writeFile(
      join(root, "dist", "index.html"),
      '<a href="https://relay.example/setup">Setup</a><a href="https://github.com/keenranger/dot-cloud-g2/issues">Help</a>',
    );
    const passed = run();
    assert.equal(passed.status, 0, passed.stderr);
    const manifest = JSON.parse(await readFile(join(root, "app.json"), "utf8"));
    const network = manifest.permissions.find((item) => item.name === "network");
    assert.deepEqual(network.whitelist, [
      "https://relay.example",
      "wss://stt-rt.soniox.com",
      "https://stt-rt.soniox.com",
      "https://console.soniox.com",
      "https://github.com",
    ]);
    assert.match(network.desc, /GitHub/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
