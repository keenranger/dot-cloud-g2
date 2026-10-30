"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ActivePairing,
  type RevealedPairing,
  checkPairing,
  confirmCreated,
  fence,
  forgetLegacyPairing,
  revealPairing,
} from "@/lib/pairing-session";
import { type Copy, type DeliveryCategory, type Locale, copy as copies } from "@/app/i18n/dashboard";

type Status = {
  deviceCount: number;
  subscribed: boolean;
  pendingCount: number;
  // Server-side STT only; the phone's Soniox key is never reported to the server.
  sttConfigured: boolean;
  eventTransport: "unverified";
  delivery?: {
    exhausted: number;
    backingOff: number;
    acceptedAwaitingReply: number;
    last: { category: DeliveryCategory; httpStatus: number | null; at: string } | null;
  };
};
const sonioxKeyGuide = "https://soniox.com/docs/guides/api-key-permissions";
// Only to remove the earlier dashboard's tab cache of a pairing code; nothing is written to it.
function tabStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
// "unavailable": the server state could not be checked, so no key is shown and none can be replaced by mistake.
type PairingState = ActivePairing | "unavailable" | undefined;
type Text = Copy["dashboard"];
function pairingFailure(t: Text, status: number, action: "create" | "reveal" | "withdraw") {
  if (status === 401) return t.sessionExpired;
  if (status === 429) return t.rateLimited;
  if (status === 503 && action !== "withdraw") return t.keyServiceUnavailable;
  if (status === 409 && action === "reveal") return t.keyNotRevealable;
  return t.keyFailed[action];
}
class SessionExpired extends Error {}
async function getActive() {
  const response = await fetch("/api/pairing", { cache: "no-store" });
  if (!response.ok) throw new Error("pairing state unavailable");
  return ((await response.json()) as { active: ActivePairing }).active;
}

export default function Dashboard({ displayName, locale }: { displayName: string; locale: Locale }) {
  // The page reloads on a language change, so the copy is fixed for this mount.
  const t = copies[locale].dashboard;
  const formatDate = (value: string | number) => new Date(value).toLocaleString(copies[locale].dateLocale);
  const [origin, setOrigin] = useState("");
  const [revoking, setRevoking] = useState(false);
  // Deleting conversations takes two deliberate steps; the second names what cannot be erased here.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deletePrompt = useRef<HTMLParagraphElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const pairingButton = useRef<HTMLButtonElement>(null);
  const withdrawButton = useRef<HTMLButtonElement>(null);
  const revealToggle = useRef<HTMLButtonElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const pairingPrompt = useRef<HTMLParagraphElement>(null);
  // Bumped when a create, withdraw, revoke, refresh or server check starts, or a session failure hides the key, so a
  // server check or reveal that started earlier cannot overwrite the newer state.
  const pairingVersion = useRef(0);
  // Bumped when the page is hidden or a pairing operation starts, so a reveal in flight is discarded, failure included,
  // without fencing the server checks themselves.
  const revealVersion = useRef(0);
  // Only the latest refresh reports the status grid or ends the checking state.
  const refreshVersion = useRef(0);
  // Set when an erase settles so focus moves only once React has re-enabled or replaced the controls.
  const focusAfterDelete = useRef<"success" | "failure" | null>(null);
  // Set when the shown key disappears while focused or a reveal disables the pressed control, so focus moves once the
  // remaining controls are enabled again.
  const focusAfterKey = useRef(false);
  // Set when a confirmed create or withdraw settles: the new key's reveal control, the create control, or the warning.
  const focusAfterPairing = useRef<"toggle" | "create" | "prompt" | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [active, setActive] = useState<PairingState>(undefined);
  // The plaintext key, in memory only while the owner has it shown. A ref mirrors it for synchronous checks.
  const [revealed, setRevealedState] = useState<RevealedPairing | null>(null);
  const revealedRef = useRef<RevealedPairing | null>(null);
  const [revealing, setRevealing] = useState(false);
  // Replacing or withdrawing the key takes two deliberate steps; the second says what stops and what keeps working.
  const [confirming, setConfirming] = useState<"rotate" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Hides the key; keyboard users land on the reveal control, and notices about the shown key go with it.
  const hideKey = useCallback(() => {
    if (revealedRef.current) {
      // Notices about the shown key leave with it.
      const keyNotices = [t.copied, t.copyUnavailable, t.keyCreatedNotice, t.keyShown];
      setMessage((current) => (keyNotices.includes(current) ? "" : current));
      const focused = document.activeElement;
      if (focused && (focused === codeInput.current || focused === copyButton.current)) focusAfterKey.current = true;
    }
    revealedRef.current = null;
    setRevealedState(null);
  }, [t]);
  // Hides the key and discards any reveal still in flight, so nothing it returns is shown or reported.
  const concealKey = useCallback(() => {
    revealVersion.current++;
    setRevealing(false);
    hideKey();
  }, [hideKey]);
  // Records the server's state for the signed-in owner; a shown key that is no longer that state is hidden.
  const showActive = useCallback(
    (next: PairingState) => {
      setActive(next);
      const current = revealedRef.current;
      if (current && (!next || next === "unavailable" || current.fingerprint !== next.fingerprint)) hideKey();
    },
    [hideKey],
  );
  // A session or state failure: nothing about the key can be vouched for.
  const dropPairing = useCallback(() => {
    pairingVersion.current++;
    setMessage((current) => (current === t.keyCreatedNotice ? "" : current));
    concealKey();
    setConfirming(null);
    setActive("unavailable");
  }, [concealKey, t]);
  // Returns undefined when an operation that started later took over.
  const syncPairing = useCallback(
    async (version?: number) => {
      const next = await checkPairing(pairingVersion, getActive, version);
      if (next !== undefined) showActive(next);
      return next;
    },
    [showActive],
  );
  // Every refresh hides the key before it asks the server and re-checks the key against the account now signed in; the
  // key can be revealed again only after the check settles. A failed refresh cannot vouch for the key, unless another
  // pairing operation started meanwhile and owns the newer state. It never issues or reveals a key.
  const refresh = useCallback(async () => {
    const version = ++pairingVersion.current;
    const run = ++refreshVersion.current;
    concealKey();
    setRefreshing(true);
    let current = false;
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (response.status === 401) throw new Error(t.sessionExpired);
      if (!response.ok) throw new Error(t.statusFailed);
      const next = (await response.json()) as Status;
      if (run === refreshVersion.current) setStatus(next);
      if (version === pairingVersion.current) setError("");
      current = true;
    } catch (cause) {
      if (run === refreshVersion.current) setStatus(null);
      if (version === pairingVersion.current) setError(cause instanceof Error ? cause.message : t.statusUnknown);
    }
    if (current) await syncPairing(version);
    else if (version === pairingVersion.current) dropPairing();
    if (run === refreshVersion.current) setRefreshing(false);
  }, [concealKey, syncPairing, dropPairing, t]);
  useEffect(() => {
    // Read the browser URL only after mounting to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    forgetLegacyPairing(tabStorage());
    // Hydrate the dashboard from the authenticated server after mounting.
    void refresh();
  }, [refresh]);
  useEffect(() => {
    // A hidden page, or one kept in the back/forward cache after signing out, drops the key and any reveal in flight.
    // Coming back, it re-checks the owner before the key can be revealed again; it never reveals by itself.
    let concealed = false;
    const conceal = () => {
      concealed = true;
      concealKey();
      // Reveal stays disabled until the check on return; a refresh already running cannot end that.
      refreshVersion.current++;
      setRefreshing(true);
    };
    const restore = () => {
      if (!concealed) return;
      concealed = false;
      void refresh();
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? conceal() : restore());
    const onPageShow = (event: PageTransitionEvent) => event.persisted && restore();
    window.addEventListener("pagehide", conceal);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", conceal);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [concealKey, refresh]);
  useEffect(() => {
    if (busy || withdrawing || !focusAfterPairing.current) return;
    const target = focusAfterPairing.current;
    focusAfterPairing.current = null;
    // Disabling the pressed button drops focus to the body; keep any place the user moved to meanwhile.
    if (document.activeElement && document.activeElement !== document.body) return;
    const preferred =
      target === "prompt" ? pairingPrompt.current : target === "toggle" ? revealToggle.current : pairingButton.current;
    [preferred, pairingButton.current, refreshButton.current]
      .find((el) => el && !(el instanceof HTMLButtonElement && el.disabled))
      ?.focus();
  }, [busy, withdrawing, active]);
  useEffect(() => {
    if (deleting || !focusAfterDelete.current) return;
    const outcome = focusAfterDelete.current;
    focusAfterDelete.current = null;
    // Disabling the pressed button drops focus to the body; keep any place the user moved to meanwhile.
    if (document.activeElement && document.activeElement !== document.body) return;
    // After a failure the warning stays open so retry and cancel are the next Tab stops.
    // A failed refresh hides the deletion group, so fall back to the always-present refresh control.
    ((outcome === "failure" ? deletePrompt.current : null) ?? deleteTrigger.current ?? refreshButton.current)?.focus();
  }, [deleting]);
  // Runs after the create/withdraw focus above, which takes precedence for the same commit.
  useEffect(() => {
    if (revealing || refreshing || busy || revoking || withdrawing || !focusAfterKey.current) return;
    focusAfterKey.current = false;
    // Removing the focused key or disabling the pressed reveal control drops focus to the body; keep any place the
    // user moved to meanwhile.
    if (document.activeElement && document.activeElement !== document.body) return;
    [revealToggle.current, pairingButton.current, refreshButton.current].find((el) => el && !el.disabled)?.focus();
  }, [revealed, revealing, refreshing, active, busy, revoking, withdrawing]);

  function startConfirm(kind: "rotate" | "withdraw") {
    setConfirming(kind);
    // Move focus to the warning so screen readers announce what stops working and what is kept.
    requestAnimationFrame(() => pairingPrompt.current?.focus());
  }
  function cancelConfirm() {
    const trigger = confirming === "withdraw" ? withdrawButton : pairingButton;
    setConfirming(null);
    // Back to the control that opened the warning; removing the pressed cancel drops focus to the body only.
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      [trigger.current, pairingButton.current, refreshButton.current].find((el) => el && !el.disabled)?.focus();
    });
  }
  async function createPairing() {
    setBusy(true);
    setError("");
    setMessage("");
    concealKey();
    // Fences server checks and reveals that started earlier; the check after the response decides what is shown.
    const version = ++pairingVersion.current;
    try {
      const response = await fetch("/api/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (response.status === 401) throw new SessionExpired(t.sessionExpired);
      if (!response.ok) throw new Error(pairingFailure(t, response.status, "create"));
      // The response may belong to an account that is no longer signed in. Its key is discarded here; the account
      // signed in now confirms it by hash, and the owner reveals it explicitly.
      const result = await confirmCreated(pairingVersion, (await response.json()) as { code: string }, getActive);
      if (result === undefined) return;
      showActive(result.active);
      setConfirming(null);
      if (result.confirmed) {
        setMessage(t.keyCreatedNotice);
        focusAfterPairing.current = "toggle";
      } else {
        setError(t.keyUnconfirmed);
        focusAfterPairing.current = "create";
      }
    } catch (cause) {
      // A refresh or another operation started meanwhile owns the newer state and its errors.
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : pairingFailure(t, 0, "create"));
      focusAfterPairing.current = "prompt";
      if (cause instanceof SessionExpired) dropPairing();
      // The server may or may not have replaced the key; show only what it still reports.
      else await syncPairing();
    } finally {
      setBusy(false);
    }
  }
  async function withdrawPairing() {
    setWithdrawing(true);
    setError("");
    setMessage("");
    concealKey();
    const version = ++pairingVersion.current;
    try {
      const response = await fetch("/api/pairing", { method: "DELETE" });
      if (response.status === 401) throw new SessionExpired(t.sessionExpired);
      if (!response.ok) throw new Error(pairingFailure(t, response.status, "withdraw"));
      if (version !== pairingVersion.current) return;
      setMessage(t.keyRevokedNotice);
      setConfirming(null);
      focusAfterPairing.current = "create";
      await syncPairing();
    } catch (cause) {
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : pairingFailure(t, 0, "withdraw"));
      focusAfterPairing.current = "prompt";
      if (cause instanceof SessionExpired) dropPairing();
      else await syncPairing();
    } finally {
      setWithdrawing(false);
    }
  }
  async function toggleKey() {
    if (revealedRef.current) {
      hideKey();
      return;
    }
    if (!active || active === "unavailable" || !active.revealable) return;
    // Every write below is skipped once a pairing operation starts or the page is hidden; that newer context owns the
    // key, the error and the reveal control's state.
    const current = fence(pairingVersion, revealVersion);
    // The pressed control is disabled while the reveal runs, which drops focus to the body.
    if (document.activeElement === revealToggle.current) focusAfterKey.current = true;
    setRevealing(true);
    setError("");
    let result: RevealedPairing | null | undefined;
    try {
      result = await revealPairing(current, active, async () => {
        const response = await fetch("/api/pairing/reveal", { method: "POST", cache: "no-store" });
        if (response.status === 401) throw new SessionExpired(t.sessionExpired);
        if (!response.ok) throw new Error(pairingFailure(t, response.status, "reveal"));
        return (await response.json()) as RevealedPairing;
      });
    } catch (cause) {
      if (!current()) return;
      setRevealing(false);
      setError(cause instanceof Error ? cause.message : pairingFailure(t, 0, "reveal"));
      if (cause instanceof SessionExpired) dropPairing();
      return;
    }
    if (result === undefined || !current()) return;
    setRevealing(false);
    if (result) {
      revealedRef.current = result;
      setRevealedState(result);
      setMessage(t.keyShown);
    } else {
      setError(t.keyMismatch);
      await syncPairing();
    }
  }
  async function revokeAll() {
    setRevoking(true);
    setError("");
    setConfirming(null);
    concealKey();
    // Fences any server check already running; creating is disabled until this settles.
    const version = ++pairingVersion.current;
    try {
      const response = await fetch("/api/devices/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (response.status === 401) throw new Error(t.sessionExpired);
      if (!response.ok) throw new Error(t.revokeAllFailed);
      if (version !== pairingVersion.current) return;
      setMessage(t.revokedAll);
      showActive(null);
      await refresh();
    } catch (cause) {
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : t.revokeAllFailed);
      // The server may or may not have withdrawn the key; show only what it still reports.
      await syncPairing();
    } finally {
      setRevoking(false);
    }
  }

  function startDelete() {
    setConfirmingDelete(true);
    // Move focus to the warning so screen readers announce what deletion cannot undo.
    requestAnimationFrame(() => deletePrompt.current?.focus());
  }
  function cancelDelete() {
    setConfirmingDelete(false);
    requestAnimationFrame(() => deleteTrigger.current?.focus());
  }
  async function deleteConversations() {
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/conversations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (response.status === 401) throw new Error(t.sessionExpired);
      if (!response.ok) throw new Error(t.deleteFailed);
      const result = (await response.json()) as { utterances: number; messages: number };
      setMessage(t.deleted(result.utterances + result.messages));
      setConfirmingDelete(false);
      focusAfterDelete.current = "success";
      await refresh();
    } catch (cause) {
      focusAfterDelete.current = "failure";
      setError(cause instanceof Error ? cause.message : t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(t.copied);
    } catch {
      setMessage(t.copyUnavailable);
    }
  }

  const unavailableStatus = refreshing ? t.statusChecking : t.statusUnavailable;
  const dotPrompt = t.dotPrompt(origin ? `${origin}/mcp` : "");

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="dashboard-title">{t.title}</h2>
          <p className="account">{displayName}</p>
        </div>
        <button
          ref={refreshButton}
          className="button secondary small"
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          {refreshing ? t.checking : t.refresh}
        </button>
      </div>
      <div className="status-grid" role="group" aria-label={t.statusLabel}>
        <StatusItem label={t.devices} value={status ? t.deviceCount(status.deviceCount) : unavailableStatus} />
        <StatusItem
          label={t.dot}
          value={status ? (status.subscribed ? t.dotSubscribed : t.dotWaiting) : unavailableStatus}
        />
        <StatusItem label={t.pending} value={status ? t.pendingCount(status.pendingCount) : unavailableStatus} />
        <StatusItem label={t.speech} value={status ? t.speechValue : unavailableStatus} />
      </div>
      {status?.delivery?.last && (
        <p className="helper">
          {t.lastDelivery(
            t.delivery[status.delivery.last.category] +
              (status.delivery.last.httpStatus ? ` (HTTP ${status.delivery.last.httpStatus})` : ""),
            formatDate(status.delivery.last.at),
            status.delivery.acceptedAwaitingReply,
            status.delivery.backingOff,
            status.delivery.exhausted,
          )}
        </p>
      )}
      <div role="status" aria-live="polite" className="feedback">
        {message}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="setup-grid">
        <section className="setup-card" aria-labelledby="pair-title">
          <span className="step" aria-hidden="true">
            01
          </span>
          <h3 id="pair-title">{t.pairTitle}</h3>
          <p>{t.pairBody}</p>
          <AddressField
            id="server-address"
            label={t.serverAddress}
            value={origin}
            pending={t.addressPending}
            copyText={t.copy}
            copyLabel={t.copyLabel(t.serverAddress)}
            onCopy={copy}
          />
          <p className="helper">{t.keyHelp}</p>
          {active && active !== "unavailable" && active.revealable && (
            <div className="pairing-result" role="group" aria-labelledby="pairing-code-label">
              <label id="pairing-code-label" htmlFor="pairing-code">
                {t.keyLabel}
              </label>
              <div className="code-row">
                <input
                  ref={codeInput}
                  id="pairing-code"
                  readOnly
                  value={revealed?.code ?? ""}
                  placeholder={t.keyHidden}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  ref={revealToggle}
                  className="button secondary small"
                  type="button"
                  aria-controls="pairing-code"
                  aria-expanded={!!revealed}
                  disabled={revealing || refreshing || busy || withdrawing || revoking}
                  onClick={() => void toggleKey()}
                >
                  {revealing ? t.checking : revealed ? t.hideKey : t.showKey}
                </button>
                <button
                  ref={copyButton}
                  className="button secondary small"
                  type="button"
                  aria-label={t.copyLabel(t.keyLabel)}
                  disabled={!revealed}
                  onClick={() => revealed && void copy(revealed.code)}
                >
                  {t.copy}
                </button>
              </div>
              {active.createdAt && <p>{t.keyCreated(formatDate(active.createdAt))}</p>}
            </div>
          )}
          {active && active !== "unavailable" && !active.revealable && (
            <p className="helper">{t.legacyCode(active.expiresAt ? formatDate(active.expiresAt) : null)}</p>
          )}
          {active === "unavailable" && <p className="helper">{t.keyUnavailable}</p>}
          <div className="pairing-actions">
            <button
              ref={pairingButton}
              type="button"
              className="button primary"
              disabled={busy || revoking || withdrawing || active === undefined || active === "unavailable"}
              onClick={() => (active ? startConfirm("rotate") : void createPairing())}
            >
              {busy ? t.creatingKey : active ? t.createNewKey : t.createKey}
            </button>
            {active && active !== "unavailable" && (
              <button
                ref={withdrawButton}
                type="button"
                className="button secondary small"
                disabled={busy || revoking || withdrawing}
                onClick={() => startConfirm("withdraw")}
              >
                {t.revokeKey}
              </button>
            )}
          </div>
          {confirming && (
            <div className="pairing-confirm" role="group" aria-labelledby="pairing-confirm-title">
              <p id="pairing-confirm-title" ref={pairingPrompt} tabIndex={-1}>
                {confirming === "rotate" ? t.confirmRotate : t.confirmRevoke}
              </p>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || withdrawing}
                onClick={() => void (confirming === "rotate" ? createPairing() : withdrawPairing())}
              >
                {confirming === "rotate"
                  ? busy
                    ? t.creatingKey
                    : t.createNewKey
                  : withdrawing
                    ? t.revokingKey
                    : t.revokeKey}
              </button>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || withdrawing}
                onClick={cancelConfirm}
              >
                {t.cancel}
              </button>
            </div>
          )}
        </section>
        <section className="setup-card" aria-labelledby="dot-title">
          <span className="step" aria-hidden="true">
            02
          </span>
          <h3 id="dot-title">{t.dotTitle}</h3>
          <p>{t.dotBody}</p>
          <ol className="setup-steps">
            {t.dotSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <AddressField
            id="mcp-address"
            label={t.mcpAddress}
            value={origin ? `${origin}/mcp` : ""}
            pending={t.addressPending}
            copyText={t.copy}
            copyLabel={t.copyLabel(t.mcpAddress)}
            onCopy={copy}
          />
          <label className="field-label" htmlFor="dot-prompt">
            {t.promptLabel}
          </label>
          <textarea id="dot-prompt" readOnly value={dotPrompt} rows={6} />
          <button className="button secondary" type="button" onClick={() => void copy(dotPrompt)}>
            {t.copyPrompt}
          </button>
        </section>
      </div>
      <section className="notice" aria-labelledby="stt-title">
        <span className="step" aria-hidden="true">
          03
        </span>
        <h3 id="stt-title">{t.speechTitle}</h3>
        <p>{t.speechBody}</p>
        <ol>
          <li>
            {t.speechSteps[0]}{" "}
            <a href={sonioxKeyGuide} target="_blank" rel="noreferrer">
              {t.sonioxGuide}
            </a>
          </li>
          <li>{t.speechSteps[1]}</li>
          <li>{t.speechSteps[2]}</li>
        </ol>
        <p>{t.speechPrivacy}</p>
      </section>
      {status && status.deviceCount > 0 && (
        <div className="device-actions">
          <p>{t.revokeAllBody}</p>
          <button
            type="button"
            className="button secondary small"
            disabled={revoking || busy}
            onClick={() => void revokeAll()}
          >
            {revoking ? t.revokingAll : t.revokeAll}
          </button>
        </div>
      )}
      {status && (
        <div className="device-actions" role="group" aria-labelledby="delete-conversations-title">
          <div>
            <p id="delete-conversations-title">{t.deleteBody}</p>
            {confirmingDelete && (
              <p ref={deletePrompt} tabIndex={-1}>
                {t.deleteConfirm}
              </p>
            )}
          </div>
          {confirmingDelete ? (
            <div>
              <button
                type="button"
                className="button secondary small"
                disabled={deleting}
                onClick={() => void deleteConversations()}
              >
                {deleting ? t.deleting : t.deleteForever}
              </button>
              <button type="button" className="button secondary small" disabled={deleting} onClick={cancelDelete}>
                {t.cancel}
              </button>
            </div>
          ) : (
            <button ref={deleteTrigger} type="button" className="button secondary small" onClick={startDelete}>
              {t.deleteStart}
            </button>
          )}
        </div>
      )}
      <section className="last-step" aria-labelledby="ask-title">
        <span className="step" aria-hidden="true">
          04
        </span>
        <div>
          <h3 id="ask-title">{t.askTitle}</h3>
          <p>{t.askBody}</p>
        </div>
      </section>
    </section>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AddressField({
  id,
  label,
  value,
  pending,
  copyText,
  copyLabel,
  onCopy,
}: {
  id: string;
  label: string;
  value: string;
  pending: string;
  copyText: string;
  copyLabel: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <div className="address-field">
      <label htmlFor={id}>{label}</label>
      <div className="code-row">
        <input id={id} readOnly value={value} placeholder={pending} />
        <button
          type="button"
          className="button secondary small"
          aria-label={copyLabel}
          disabled={!value}
          onClick={() => void onCopy(value)}
        >
          {copyText}
        </button>
      </div>
    </div>
  );
}
