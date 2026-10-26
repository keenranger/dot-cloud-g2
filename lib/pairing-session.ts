// The dashboard keeps the connection key's plaintext only in memory while the owner has it shown. The server is the
// source of truth: metadata (the key's hash) says which key the signed-in owner has, and an explicit reveal returns it.
export type ActivePairing = {
  fingerprint: string;
  createdAt: string | null;
  // False for a code issued before connection keys were sealed: it keeps its fixed expiry and cannot be shown again.
  revealable: boolean;
  expiresAt: string | null;
} | null;
export type RevealedPairing = { code: string; fingerprint: string };
type PairingStorage = Pick<Storage, "removeItem">;

// The tab cache used by the earlier reusable-code dashboard. Only this entry is removed.
const legacyKey = "even-hub-pairing";

export async function fingerprint(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function forgetLegacyPairing(storage: PairingStorage | null) {
  try {
    storage?.removeItem(legacyKey);
  } catch {
    // Unreadable storage holds nothing that could be shown.
  }
}
// Each pairing operation that changes what the key is (create, withdraw, revoke, refresh, a session failure) takes a
// number from `latest` when it starts. A result is used only while no such operation started after it; `undefined`
// means a newer one took over. A failed check cannot vouch for any key, so it reports "unavailable", never "none".
export async function checkPairing(
  latest: { current: number },
  getActive: () => Promise<ActivePairing>,
  version = ++latest.current,
): Promise<ActivePairing | "unavailable" | undefined> {
  if (version !== latest.current) return undefined;
  let active: ActivePairing | "unavailable";
  try {
    active = await getActive();
  } catch {
    active = "unavailable";
  }
  return version === latest.current ? active : undefined;
}
// The created key is discarded; the owner signed in now confirms it by hash, so a response for an account that is no
// longer signed in is never reported as this account's new key.
export async function confirmCreated(
  latest: { current: number },
  created: { code: string },
  getActive: () => Promise<ActivePairing>,
) {
  // The check's place in the order is taken when the response arrives, before hashing yields.
  const version = ++latest.current;
  const expected = await fingerprint(created.code);
  const active = await checkPairing(latest, getActive, version);
  if (active === undefined) return undefined;
  return { active, confirmed: !!active && active !== "unavailable" && active.fingerprint === expected };
}
// Takes the counters' current values; the returned check is true while none of them has moved since.
export function fence(...counters: { current: number }[]) {
  const taken = counters.map((counter) => counter.current);
  return () => counters.every((counter, i) => counter.current === taken[i]);
}
// A reveal does not start a new operation; `current` turns false when one starts or the page is hidden, and then the
// reveal's result is discarded, failure included, so a late 401 cannot hide or explain a newer key. The key is shown
// only if it is the key this page currently names for the owner, so a rotation elsewhere or an account change returns
// null instead of a key the page does not describe.
export async function revealPairing(
  current: () => boolean,
  shown: ActivePairing | "unavailable",
  getReveal: () => Promise<RevealedPairing>,
) {
  let revealed: RevealedPairing;
  try {
    revealed = await getReveal();
  } catch (cause) {
    if (!current()) return undefined;
    throw cause;
  }
  if (!current()) return undefined;
  if (
    !shown ||
    shown === "unavailable" ||
    revealed.fingerprint !== shown.fingerprint ||
    (await fingerprint(revealed.code)) !== shown.fingerprint
  )
    return current() ? null : undefined;
  return current() ? revealed : undefined;
}
