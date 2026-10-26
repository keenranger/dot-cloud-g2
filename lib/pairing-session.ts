// Keeps the dashboard's pairing code across reloads of the same browser tab. The server stores only the code's hash,
// so a stored code is shown again only while the signed-in owner's server state names it as the active, unexpired code.
export type Pairing = { code: string; expiresAt: string };
export type ActivePairing = { fingerprint: string; expiresAt: string } | null;
type PairingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const key = "even-hub-pairing";

async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function savePairing(storage: PairingStorage | null, pairing: Pairing) {
  try {
    storage?.setItem(key, JSON.stringify({ code: pairing.code, expiresAt: pairing.expiresAt }));
  } catch {
    // Without storage the code is only lost on reload; the page still works.
  }
}
export function clearPairing(storage: PairingStorage | null) {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing was readable either, so nothing can be restored.
  }
}
// Any mismatch, expiry or unreadable entry erases the stored code instead of showing it.
export async function restorePairing(storage: PairingStorage | null, active: ActivePairing, now = Date.now()) {
  let stored: Pairing | null = null;
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key) ?? null;
    const value: unknown = JSON.parse(raw ?? "null");
    if (
      value &&
      typeof value === "object" &&
      "code" in value &&
      "expiresAt" in value &&
      typeof value.code === "string" &&
      typeof value.expiresAt === "string" &&
      /^[a-f0-9]{64}$/.test(value.code)
    )
      stored = { code: value.code, expiresAt: value.expiresAt };
  } catch {
    stored = null;
  }
  if (
    stored &&
    active &&
    active.expiresAt === stored.expiresAt &&
    Date.parse(stored.expiresAt) > now &&
    active.fingerprint === (await sha256(stored.code))
  )
    return stored;
  // A code saved while this check ran is newer than what was checked, so it is left for its own check.
  try {
    if (storage?.getItem(key) === raw) clearPairing(storage);
  } catch {
    // Unreadable storage holds nothing that could be shown.
  }
  return null;
}
// Each pairing operation takes a number from `latest` when it starts. A check changes the stored code only while no
// operation started after it, so the latest-started check decides; `undefined` means a newer operation took over.
export async function checkPairing(
  storage: PairingStorage | null,
  latest: { current: number },
  getActive: () => Promise<ActivePairing>,
  version = ++latest.current,
) {
  if (version !== latest.current) return undefined;
  let active: ActivePairing = null;
  try {
    active = await getActive();
  } catch {
    active = null;
  }
  if (version !== latest.current) return undefined;
  const restored = await restorePairing(storage, active);
  return version === latest.current ? restored : undefined;
}
