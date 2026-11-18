"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
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
// Astryx buttons are disabled with aria-disabled and keep focus, where a native disabled button dropped it to the body.
function isEnabled(el: HTMLElement) {
  return !(el instanceof HTMLButtonElement && el.disabled) && el.getAttribute("aria-disabled") !== "true";
}
// Focus counts as not moved by the user when it fell to the body, stayed on the control that started the operation,
// or sits on a control that is still disabled.
function focusUnmoved(pressed: Element | null) {
  const focused = document.activeElement;
  return (
    !focused ||
    focused === document.body ||
    focused === pressed ||
    (focused instanceof HTMLElement && focused.getAttribute("aria-disabled") === "true")
  );
}
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
  const deletePrompt = useRef<HTMLElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const pairingButton = useRef<HTMLButtonElement>(null);
  const withdrawButton = useRef<HTMLButtonElement>(null);
  const revealToggle = useRef<HTMLButtonElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const pairingPrompt = useRef<HTMLElement>(null);
  // The control focused when a create, withdraw, reveal or erase started; Astryx keeps it focused while it is busy.
  const pressedControl = useRef<Element | null>(null);
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
    const pressed = pressedControl.current;
    pressedControl.current = null;
    // Keep any place the user moved to meanwhile.
    if (!focusUnmoved(pressed)) return;
    const preferred =
      target === "prompt" ? pairingPrompt.current : target === "toggle" ? revealToggle.current : pairingButton.current;
    [preferred, pairingButton.current, refreshButton.current].find((el) => el && isEnabled(el))?.focus();
  }, [busy, withdrawing, active]);
  useEffect(() => {
    if (deleting || !focusAfterDelete.current) return;
    const outcome = focusAfterDelete.current;
    focusAfterDelete.current = null;
    const pressed = pressedControl.current;
    pressedControl.current = null;
    // Keep any place the user moved to meanwhile.
    if (!focusUnmoved(pressed)) return;
    // After a failure the warning stays open so retry and cancel are the next Tab stops.
    // A failed refresh hides the deletion group, so fall back to the always-present refresh control.
    ((outcome === "failure" ? deletePrompt.current : null) ?? deleteTrigger.current ?? refreshButton.current)?.focus();
  }, [deleting]);
  // Runs after the create/withdraw focus above, which takes precedence for the same commit.
  useEffect(() => {
    if (revealing || refreshing || busy || revoking || withdrawing || !focusAfterKey.current) return;
    focusAfterKey.current = false;
    const pressed = pressedControl.current;
    pressedControl.current = null;
    // Removing the focused key, disabling the copy control or a busy reveal control leaves focus unmoved; keep any
    // place the user moved to meanwhile.
    if (!focusUnmoved(pressed)) return;
    [revealToggle.current, pairingButton.current, refreshButton.current].find((el) => el && isEnabled(el))?.focus();
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
      if (!focusUnmoved(null)) return;
      [trigger.current, pairingButton.current, refreshButton.current].find((el) => el && isEnabled(el))?.focus();
    });
  }
  async function createPairing() {
    pressedControl.current = document.activeElement;
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
      // A superseded run sets no focus target; drop its pressed control so a later focus check cannot use it.
      if (!focusAfterPairing.current) pressedControl.current = null;
      setBusy(false);
    }
  }
  async function withdrawPairing() {
    pressedControl.current = document.activeElement;
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
      if (!focusAfterPairing.current) pressedControl.current = null;
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
    // The pressed control is disabled while the reveal runs; focus returns to it once it is enabled again.
    if (document.activeElement === revealToggle.current) {
      pressedControl.current = revealToggle.current;
      focusAfterKey.current = true;
    }
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
    pressedControl.current = document.activeElement;
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
      <VStack gap={6}>
        <HStack gap={5} vAlign="center" hAlign="between" wrap="wrap">
          <VStack gap={1} className="dashboard-heading">
            <Text as="p" type="label" color="secondary" className="eyebrow">
              {t.eyebrow}
            </Text>
            <Heading level={2} id="dashboard-title">
              {t.title}
            </Heading>
            <Text as="p" type="supporting" color="secondary" className="account">
              {displayName}
            </Text>
          </VStack>
          <Button
            ref={refreshButton}
            size="sm"
            label={refreshing ? t.checking : t.refresh}
            isDisabled={refreshing}
            onClick={() => void refresh()}
          />
        </HStack>
        <Grid columns={{ minWidth: 160, max: 4 }} width="100%" gap={3} role="group" aria-label={t.statusLabel}>
          <StatusItem label={t.devices} value={status ? t.deviceCount(status.deviceCount) : unavailableStatus} />
          <StatusItem
            label={t.dot}
            value={status ? (status.subscribed ? t.dotSubscribed : t.dotWaiting) : unavailableStatus}
            tone={status ? (status.subscribed ? "success" : "warning") : "neutral"}
          />
          <StatusItem label={t.pending} value={status ? t.pendingCount(status.pendingCount) : unavailableStatus} />
          <StatusItem label={t.speech} value={status ? t.speechValue : unavailableStatus} />
        </Grid>
        {status?.delivery?.last && (
          <Text as="p" type="supporting" color="secondary">
            {t.lastDelivery(
              t.delivery[status.delivery.last.category] +
                (status.delivery.last.httpStatus ? ` (HTTP ${status.delivery.last.httpStatus})` : ""),
              formatDate(status.delivery.last.at),
              status.delivery.acceptedAwaitingReply,
              status.delivery.backingOff,
              status.delivery.exhausted,
            )}
          </Text>
        )}
        {/* Always mounted so screen readers hear each new notice. */}
        <div role="status" aria-live="polite" className="feedback">
          {message && (
            <Text type="supporting" color="accent" weight="semibold">
              {message}
            </Text>
          )}
        </div>
        {error && <Banner status="error" role="alert" title={error} collapsible={false} />}
        <Grid columns={{ minWidth: 320, max: 2 }} width="100%" gap={4}>
          <Card role="region" aria-labelledby="pair-title" padding={6} elevation="low">
            <VStack gap={4}>
              <StepHeader step="01" id="pair-title" title={t.pairTitle} />
              <Text as="p" color="secondary">
                {t.pairBody}
              </Text>
              <AddressField
                id="server-address"
                label={t.serverAddress}
                value={origin}
                pending={t.addressPending}
                copyText={t.copy}
                copyLabel={t.copyLabel(t.serverAddress)}
                onCopy={copy}
              />
              <Text as="p" type="supporting" color="secondary">
                {t.keyHelp}
              </Text>
              {active && active !== "unavailable" && active.revealable && (
                <VStack gap={2}>
                  <Divider />
                  <HStack gap={2} vAlign="end" wrap="wrap" role="group" aria-label={t.keyLabel} className="field-row">
                    <div className="field-grow">
                      <TextInput
                        ref={codeInput}
                        id="pairing-code"
                        label={t.keyLabel}
                        isReadOnly
                        value={revealed?.code ?? ""}
                        placeholder={t.keyHidden}
                        autoComplete="off"
                        hasSpellCheck={false}
                        width="100%"
                      />
                    </div>
                    <Button
                      ref={revealToggle}
                      size="md"
                      label={revealing ? t.checking : revealed ? t.hideKey : t.showKey}
                      aria-controls="pairing-code"
                      aria-expanded={!!revealed}
                      isDisabled={revealing || refreshing || busy || withdrawing || revoking}
                      onClick={() => void toggleKey()}
                    />
                    <Button
                      ref={copyButton}
                      size="md"
                      label={t.copyLabel(t.keyLabel)}
                      isDisabled={!revealed}
                      onClick={() => revealed && void copy(revealed.code)}
                    >
                      {t.copy}
                    </Button>
                  </HStack>
                  {active.createdAt && (
                    <Text as="p" type="supporting" color="secondary">
                      {t.keyCreated(formatDate(active.createdAt))}
                    </Text>
                  )}
                </VStack>
              )}
              {active && active !== "unavailable" && !active.revealable && (
                <Text as="p" type="supporting" color="secondary">
                  {t.legacyCode(active.expiresAt ? formatDate(active.expiresAt) : null)}
                </Text>
              )}
              {active === "unavailable" && (
                <Text as="p" type="supporting" color="secondary">
                  {t.keyUnavailable}
                </Text>
              )}
              <HStack gap={2} wrap="wrap">
                <Button
                  ref={pairingButton}
                  variant="primary"
                  label={busy ? t.creatingKey : active ? t.createNewKey : t.createKey}
                  isDisabled={busy || revoking || withdrawing || active === undefined || active === "unavailable"}
                  onClick={() => (active ? startConfirm("rotate") : void createPairing())}
                />
                {active && active !== "unavailable" && (
                  <Button
                    ref={withdrawButton}
                    variant="ghost"
                    label={t.revokeKey}
                    isDisabled={busy || revoking || withdrawing}
                    onClick={() => startConfirm("withdraw")}
                  />
                )}
              </HStack>
              {confirming && (
                <Card variant="yellow" padding={4} role="group" aria-labelledby="pairing-confirm-title">
                  <VStack gap={3}>
                    <Text as="p" id="pairing-confirm-title" ref={pairingPrompt} tabIndex={-1} weight="medium">
                      {confirming === "rotate" ? t.confirmRotate : t.confirmRevoke}
                    </Text>
                    <HStack gap={2} wrap="wrap">
                      <Button
                        variant="destructive"
                        size="sm"
                        label={
                          confirming === "rotate"
                            ? busy
                              ? t.creatingKey
                              : t.createNewKey
                            : withdrawing
                              ? t.revokingKey
                              : t.revokeKey
                        }
                        isDisabled={busy || withdrawing}
                        onClick={() => void (confirming === "rotate" ? createPairing() : withdrawPairing())}
                      />
                      <Button size="sm" label={t.cancel} isDisabled={busy || withdrawing} onClick={cancelConfirm} />
                    </HStack>
                  </VStack>
                </Card>
              )}
            </VStack>
          </Card>
          <Card role="region" aria-labelledby="dot-title" padding={6} elevation="low">
            <VStack gap={4}>
              <StepHeader step="02" id="dot-title" title={t.dotTitle} />
              <Text as="p" color="secondary">
                {t.dotBody}
              </Text>
              <ol className="steps">
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
              <TextArea id="dot-prompt" label={t.promptLabel} isReadOnly value={dotPrompt} rows={6} />
              <HStack>
                <Button label={t.copyPrompt} onClick={() => void copy(dotPrompt)} />
              </HStack>
            </VStack>
          </Card>
        </Grid>
        <Card role="region" aria-labelledby="stt-title" variant="muted" padding={6}>
          <VStack gap={3}>
            <StepHeader step="03" id="stt-title" title={t.speechTitle} />
            <Text as="p" color="secondary">
              {t.speechBody}
            </Text>
            <ol className="steps">
              <li>
                {t.speechSteps[0]}{" "}
                <Link href={sonioxKeyGuide} as="a" target="_blank" rel="noreferrer" hasUnderline>
                  {t.sonioxGuide}
                </Link>
              </li>
              <li>{t.speechSteps[1]}</li>
              <li>{t.speechSteps[2]}</li>
            </ol>
            <Text as="p" type="supporting" color="secondary">
              {t.speechPrivacy}
            </Text>
          </VStack>
        </Card>
        <VStack gap={0}>
          {status && status.deviceCount > 0 && (
            <>
              <Divider />
              <HStack gap={4} vAlign="center" hAlign="between" wrap="wrap" paddingBlock={4}>
                <Text as="p" type="supporting" color="secondary" className="action-copy">
                  {t.revokeAllBody}
                </Text>
                <Button
                  size="sm"
                  label={revoking ? t.revokingAll : t.revokeAll}
                  isDisabled={revoking || busy}
                  onClick={() => void revokeAll()}
                />
              </HStack>
            </>
          )}
          {status && (
            <>
              <Divider />
              <HStack
                gap={4}
                vAlign="center"
                hAlign="between"
                wrap="wrap"
                paddingBlock={4}
                role="group"
                aria-labelledby="delete-conversations-title"
              >
                <VStack gap={2} className="action-copy">
                  <Text as="p" type="supporting" color="secondary" id="delete-conversations-title">
                    {t.deleteBody}
                  </Text>
                  {confirmingDelete && (
                    <Text as="p" ref={deletePrompt} tabIndex={-1} type="supporting" weight="semibold">
                      {t.deleteConfirm}
                    </Text>
                  )}
                </VStack>
                {confirmingDelete ? (
                  <HStack gap={2} wrap="wrap">
                    <Button
                      variant="destructive"
                      size="sm"
                      label={deleting ? t.deleting : t.deleteForever}
                      isDisabled={deleting}
                      onClick={() => void deleteConversations()}
                    />
                    <Button size="sm" label={t.cancel} isDisabled={deleting} onClick={cancelDelete} />
                  </HStack>
                ) : (
                  <Button ref={deleteTrigger} size="sm" label={t.deleteStart} onClick={startDelete} />
                )}
              </HStack>
              <Divider />
            </>
          )}
        </VStack>
        <section aria-labelledby="ask-title">
          <HStack gap={5} vAlign="start" wrap="wrap">
            <StepBadge step="04" />
            <VStack gap={2} className="action-copy">
              <Heading level={3} id="ask-title">
                {t.askTitle}
              </Heading>
              <Text as="p" color="secondary">
                {t.askBody}
              </Text>
            </VStack>
          </HStack>
        </section>
      </VStack>
    </section>
  );
}

// The step number is decorative; the heading order already conveys the sequence.
function StepBadge({ step }: { step: string }) {
  return (
    <span aria-hidden="true">
      <Badge variant="green" label={step} />
    </span>
  );
}

function StepHeader({ step, id, title }: { step: string; id: string; title: string }) {
  return (
    <VStack gap={2}>
      <StepBadge step={step} />
      <Heading level={3} id={id}>
        {title}
      </Heading>
    </VStack>
  );
}

function StatusItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <Card padding={4} elevation="low">
      <VStack gap={1}>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
        <HStack gap={2} vAlign="center">
          {tone && (
            <span aria-hidden="true">
              <StatusDot variant={tone} label={value} />
            </span>
          )}
          <Text type="large" weight="semibold">
            {value}
          </Text>
        </HStack>
      </VStack>
    </Card>
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
    <HStack gap={2} vAlign="end" className="field-row">
      <div className="field-grow">
        <TextInput id={id} label={label} isReadOnly value={value} placeholder={pending} width="100%" />
      </div>
      <Button label={copyLabel} isDisabled={!value} onClick={() => void onCopy(value)}>
        {copyText}
      </Button>
    </HStack>
  );
}
