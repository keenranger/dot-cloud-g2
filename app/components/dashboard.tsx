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

type DeliveryCategory =
  | "accepted"
  | "http_4xx"
  | "http_5xx"
  | "http_other"
  | "timeout"
  | "network"
  | "invalid_response";
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
const deliveryLabels: Record<DeliveryCategory, string> = {
  accepted: "Dot 이벤트 주소가 수신함",
  http_4xx: "Dot 이벤트 주소가 거절함",
  http_5xx: "Dot 이벤트 주소 오류",
  http_other: "예상하지 못한 응답",
  timeout: "응답 시간 초과",
  network: "네트워크 오류",
  invalid_response: "잘못된 응답",
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
const copied = "복사했습니다.";
const copyUnavailable = "자동 복사를 사용할 수 없습니다. 표시된 내용을 직접 선택해 복사해 주세요.";
const createdNotice =
  "새 연결 키를 만들었습니다. 이전 키로는 이제 새 기기를 연결할 수 없고, 이미 연결된 기기는 그대로입니다. 키 확인을 눌러 Even Hub 앱에 입력해 주세요.";
const withdrawnNotice = "연결 키를 폐기했습니다. 이제 새 기기를 연결할 수 없고, 이미 연결된 기기는 그대로입니다.";
const sessionExpired = "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
const keyNotices = [copied, copyUnavailable, createdNotice, "연결 키를 표시했습니다."];
function pairingFailure(status: number, action: "create" | "reveal" | "withdraw") {
  if (status === 401) return sessionExpired;
  if (status === 429) return "요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도해 주세요.";
  if (status === 503 && action !== "withdraw")
    return "서버의 연결 키 보호 설정이 준비되지 않아 지금은 키를 만들거나 보여 줄 수 없습니다. 기존 키와 연결된 기기는 그대로 동작합니다.";
  if (status === 409 && action === "reveal")
    return "저장된 연결 키를 다시 열 수 없습니다. 기존 키와 연결된 기기는 그대로이며, 키가 필요하면 새 연결 키를 만들어 주세요.";
  return {
    create: "연결 키를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
    reveal: "연결 키를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    withdraw: "연결 키를 폐기하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  }[action];
}
class SessionExpired extends Error {}
async function getActive() {
  const response = await fetch("/api/pairing", { cache: "no-store" });
  if (!response.ok) throw new Error("pairing state unavailable");
  return ((await response.json()) as { active: ActivePairing }).active;
}
const dotPrompt = `G2 Bridge 플러그인의 "utterance.created" 이벤트를 session "g2"로 구독해 줘. 새 음성 입력을 받으면 한국어로 답하고, reply_to_g2 도구에 받은 것과 동일한 utterance_id와 한국어 답변 text를 보내 줘. 이벤트 전달이 실제로 확인되기 전에는 연결되었다고 말하지 마.`;

export default function Dashboard({ displayName }: { displayName: string }) {
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
      setMessage((current) => (keyNotices.includes(current) ? "" : current));
      const focused = document.activeElement;
      if (focused && (focused === codeInput.current || focused === copyButton.current)) focusAfterKey.current = true;
    }
    revealedRef.current = null;
    setRevealedState(null);
  }, []);
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
    setMessage((current) => (current === createdNotice ? "" : current));
    concealKey();
    setConfirming(null);
    setActive("unavailable");
  }, [concealKey]);
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
      if (response.status === 401) throw new Error(sessionExpired);
      if (!response.ok) throw new Error("연결 상태를 불러오지 못했습니다. 다시 확인해 주세요.");
      const next = (await response.json()) as Status;
      if (run === refreshVersion.current) setStatus(next);
      if (version === pairingVersion.current) setError("");
      current = true;
    } catch (cause) {
      if (run === refreshVersion.current) setStatus(null);
      if (version === pairingVersion.current)
        setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했습니다.");
    }
    if (current) await syncPairing(version);
    else if (version === pairingVersion.current) dropPairing();
    if (run === refreshVersion.current) setRefreshing(false);
  }, [concealKey, syncPairing, dropPairing]);
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
      if (response.status === 401) throw new SessionExpired(sessionExpired);
      if (!response.ok) throw new Error(pairingFailure(response.status, "create"));
      // The response may belong to an account that is no longer signed in. Its key is discarded here; the account
      // signed in now confirms it by hash, and the owner reveals it explicitly.
      const result = await confirmCreated(pairingVersion, (await response.json()) as { code: string }, getActive);
      if (result === undefined) return;
      showActive(result.active);
      setConfirming(null);
      if (result.confirmed) {
        setMessage(createdNotice);
        focusAfterPairing.current = "toggle";
      } else {
        setError("만든 키를 지금 로그인한 계정에서 확인하지 못했습니다. 상태 새로고침으로 현재 키를 확인해 주세요.");
        focusAfterPairing.current = "create";
      }
    } catch (cause) {
      // A refresh or another operation started meanwhile owns the newer state and its errors.
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : pairingFailure(0, "create"));
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
      if (response.status === 401) throw new SessionExpired(sessionExpired);
      if (!response.ok) throw new Error(pairingFailure(response.status, "withdraw"));
      if (version !== pairingVersion.current) return;
      setMessage(withdrawnNotice);
      setConfirming(null);
      focusAfterPairing.current = "create";
      await syncPairing();
    } catch (cause) {
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : pairingFailure(0, "withdraw"));
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
        if (response.status === 401) throw new SessionExpired(sessionExpired);
        if (!response.ok) throw new Error(pairingFailure(response.status, "reveal"));
        return (await response.json()) as RevealedPairing;
      });
    } catch (cause) {
      if (!current()) return;
      setRevealing(false);
      setError(cause instanceof Error ? cause.message : pairingFailure(0, "reveal"));
      if (cause instanceof SessionExpired) dropPairing();
      return;
    }
    if (result === undefined || !current()) return;
    setRevealing(false);
    if (result) {
      revealedRef.current = result;
      setRevealedState(result);
      setMessage("연결 키를 표시했습니다.");
    } else {
      setError("이 화면이 알고 있는 키와 서버의 현재 키가 달라 표시하지 않았습니다. 최신 상태를 다시 확인했습니다.");
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
      if (!response.ok) throw new Error("기기 연결을 해제하지 못했습니다.");
      if (version !== pairingVersion.current) return;
      setMessage("내 모든 기기 연결을 해제하고 연결 키도 폐기했습니다. 다시 사용하려면 새 연결 키로 페어링해 주세요.");
      showActive(null);
      await refresh();
    } catch (cause) {
      if (version !== pairingVersion.current) return;
      setError(cause instanceof Error ? cause.message : "기기 연결을 해제하지 못했습니다.");
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
      if (response.status === 401) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      if (!response.ok) throw new Error("대화 기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      const result = (await response.json()) as { utterances: number; messages: number };
      setMessage(
        `서버의 대화 기록 ${result.utterances + result.messages}건을 삭제했습니다. 기기 연결과 Dot 구독은 그대로입니다.`,
      );
      setConfirmingDelete(false);
      focusAfterDelete.current = "success";
      await refresh();
    } catch (cause) {
      focusAfterDelete.current = "failure";
      setError(cause instanceof Error ? cause.message : "대화 기록을 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(copied);
    } catch {
      setMessage(copyUnavailable);
    }
  }

  const unavailableStatus = refreshing ? "확인 중" : "확인 불가";

  return (
    <section className="dashboard" aria-label="내 연결 설정">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR CONNECTION</p>
          <h2>내 연결 설정</h2>
          <p className="account">{displayName}</p>
        </div>
        <button
          ref={refreshButton}
          className="button secondary small"
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          {refreshing ? "확인 중…" : "상태 새로고침"}
        </button>
      </div>
      <div className="status-grid" aria-label="내 연결 상태">
        <StatusItem label="등록된 기기" value={status ? `${status.deviceCount}대` : unavailableStatus} />
        <StatusItem
          label="Dot 구독"
          value={status ? (status.subscribed ? "구독 등록됨" : "구독 대기") : unavailableStatus}
        />
        <StatusItem label="대기 중인 음성 입력" value={status ? `${status.pendingCount}건` : unavailableStatus} />
        <StatusItem label="음성 인식" value={status ? "휴대폰 앱에서 확인" : unavailableStatus} />
      </div>
      {status?.delivery?.last && (
        <p className="helper">
          최근 Dot 전달: {deliveryLabels[status.delivery.last.category]}
          {status.delivery.last.httpStatus ? ` (HTTP ${status.delivery.last.httpStatus})` : ""},{" "}
          {new Date(status.delivery.last.at).toLocaleString("ko-KR")}. 답변 대기 {status.delivery.acceptedAwaitingReply}
          건, 재시도 대기 {status.delivery.backingOff}건, 재시도 중단 {status.delivery.exhausted}건. 수신은 Dot이
          처리했거나 G2에 표시되었다는 뜻이 아닙니다.
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
          <span className="step">01</span>
          <h3 id="pair-title">연결 1: Even Hub 기기 페어링</h3>
          <p>
            G2 안경과 이 서버를 잇는 연결입니다. ChatGPT 연결과는 별개입니다. 휴대폰의 Even Hub에서 G2 Bridge 앱을 열고,
            아래 서버 주소와 연결 키를 입력하세요. 안경이 휴대폰에 연결되어 있어야 합니다.
          </p>
          <AddressField label="Even Hub 서버 주소" value={origin} onCopy={copy} />
          <p className="helper">
            연결 키는 만료되지 않으며 여러 기기에 반복해서 쓸 수 있습니다. 평소에는 가려져 있고, 이 계정으로 로그인한
            상태에서 키 확인을 누르면 언제든 다시 보고 복사할 수 있습니다. 새 키를 만들거나 키를 폐기하면 이전 키로는 새
            기기를 연결할 수 없지만, 이미 연결된 기기는 그대로 유지됩니다.
          </p>
          {active && active !== "unavailable" && active.revealable && (
            <div className="pairing-result" role="group" aria-labelledby="pairing-code-label">
              <label id="pairing-code-label" htmlFor="pairing-code">
                Even Hub 연결 키
              </label>
              <div className="code-row">
                <input
                  ref={codeInput}
                  id="pairing-code"
                  readOnly
                  value={revealed?.code ?? ""}
                  placeholder="가려짐 · 키 확인을 누르세요"
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
                  {revealing ? "확인 중…" : revealed ? "키 숨기기" : "키 확인"}
                </button>
                <button
                  ref={copyButton}
                  className="button secondary small"
                  type="button"
                  aria-label="Even Hub 연결 키 복사"
                  disabled={!revealed}
                  onClick={() => revealed && void copy(revealed.code)}
                >
                  복사
                </button>
              </div>
              {active.createdAt && <p>만든 시각: {new Date(active.createdAt).toLocaleString("ko-KR")} · 만료 없음</p>}
            </div>
          )}
          {active && active !== "unavailable" && !active.revealable && (
            <p className="helper">
              이전 방식의 10분 연결 코드가 남아 있습니다
              {active.expiresAt ? `(만료 ${new Date(active.expiresAt).toLocaleString("ko-KR")})` : ""}. 이 코드는 다시
              볼 수 없으니, 새 연결 키를 한 번 만들어 주세요. 새 키는 만료 없이 계속 쓸 수 있습니다.
            </p>
          )}
          {active === "unavailable" && (
            <p className="helper">
              연결 키 상태를 확인하지 못했습니다. 상태 새로고침으로 다시 확인해 주세요. 확인 전에는 키를 새로 만들 수
              없습니다.
            </p>
          )}
          <div className="pairing-actions">
            <button
              ref={pairingButton}
              type="button"
              className="button primary"
              disabled={busy || revoking || withdrawing || active === undefined || active === "unavailable"}
              onClick={() => (active ? startConfirm("rotate") : void createPairing())}
            >
              {busy ? "키 만드는 중…" : active ? "새 연결 키 만들기" : "연결 키 만들기"}
            </button>
            {active && active !== "unavailable" && (
              <button
                ref={withdrawButton}
                type="button"
                className="button secondary small"
                disabled={busy || revoking || withdrawing}
                onClick={() => startConfirm("withdraw")}
              >
                연결 키 폐기
              </button>
            )}
          </div>
          {confirming && (
            <div className="pairing-confirm" role="group" aria-labelledby="pairing-confirm-title">
              <p id="pairing-confirm-title" ref={pairingPrompt} tabIndex={-1}>
                {confirming === "rotate"
                  ? "새 키를 만들면 지금 키로는 더 이상 새 기기를 연결할 수 없습니다. 이미 연결된 기기는 그대로 유지됩니다. 새 키를 만들까요?"
                  : "키를 폐기하면 새 키를 만들기 전까지 어떤 기기도 새로 연결할 수 없습니다. 이미 연결된 기기는 그대로 유지됩니다. 폐기할까요?"}
              </p>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || withdrawing}
                onClick={() => void (confirming === "rotate" ? createPairing() : withdrawPairing())}
              >
                {confirming === "rotate"
                  ? busy
                    ? "키 만드는 중…"
                    : "새 키 만들기"
                  : withdrawing
                    ? "폐기 중…"
                    : "연결 키 폐기"}
              </button>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || withdrawing}
                onClick={cancelConfirm}
              >
                취소
              </button>
            </div>
          )}
        </section>
        <section className="setup-card" aria-labelledby="dot-title">
          <span className="step">02</span>
          <h3 id="dot-title">연결 2: ChatGPT MCP 서버 추가</h3>
          <p>
            Dot과 이 서버를 잇는 연결로, Even Hub 연결 키는 쓰지 않습니다. 이 사이트의 MCP 플러그인이 ChatGPT에 설치되어
            있어야 합니다. 없다면 데스크톱 브라우저의 ChatGPT 웹에서 아래 주소를 사용자 지정 MCP 서버로 추가하고
            설치하세요. 그다음 Dot에 아래 요청을 보내 이벤트 구독을 요청하세요. 같은 Dot을 모바일 앱에서도 이어서 쓸 수
            있지만, 구독 생성과 휴대폰 앱에서의 이벤트 전달은 아직 확인되지 않았습니다.
          </p>
          <AddressField label="Dot MCP 서버 주소" value={origin ? `${origin}/mcp` : ""} onCopy={copy} />
          <label className="sr-only" htmlFor="dot-prompt">
            Dot에 보낼 설정 요청
          </label>
          <textarea id="dot-prompt" readOnly value={dotPrompt} rows={6} />
          <button className="button secondary" type="button" onClick={() => void copy(dotPrompt)}>
            설정 요청 복사
          </button>
        </section>
      </div>
      <section className="notice" aria-labelledby="stt-title">
        <strong id="stt-title">음성 인식: 휴대폰의 G2 Bridge 앱에 Soniox API 키 입력</strong>
        <p>
          음성은 휴대폰에서 Soniox 클라우드로 바로 전송되어 그곳에서 텍스트로 바뀌고(기기 내 음성 인식 아님), 이
          서버에는 변환된 텍스트만 전달됩니다. 이 사이트에는 API 키를 입력하지 마세요. 서버 관리자 설정도 필요하지
          않습니다.
        </p>
        <ol>
          <li>
            Soniox 콘솔에서 본인 계정의 API 키를 만들고 실시간 음성 인식(real-time transcription) 권한을 허용하세요.{" "}
            <a href={sonioxKeyGuide} target="_blank" rel="noreferrer">
              Soniox API 키 권한 안내(새 창)
            </a>
          </li>
          <li>휴대폰 Even Hub에서 G2 Bridge 앱의 설정을 열고 키를 붙여 넣으세요.</li>
          <li>
            키는 기본적으로 앱을 사용하는 동안에만 메모리에 보관됩니다. 기억하기를 선택하면 Even Hub 앱 저장소에 남으며,
            같은 설정 화면에서 언제든 지우거나 새 키로 바꿀 수 있습니다.
          </li>
        </ol>
        <p>
          기억한 키의 안전성은 휴대폰과 Even Hub 앱을 얼마나 믿을 수 있는지에 달려 있으며, 별도 암호화나 유출 방지를
          보장하지 않습니다. 사용 요금은 본인 Soniox 계정에 청구되고, 변환된 텍스트는 이 서버에 저장된 뒤 Dot에
          전달됩니다.
        </p>
        <p>
          이 서버는 휴대폰에 키가 입력되었는지 알 수 없으니 휴대폰 앱에서 확인하세요. 서버 측 음성 인식(이전 방식):{" "}
          {status
            ? status.sttConfigured
              ? "서버에 설정되어 있음, 휴대폰 키와는 별개"
              : "사용 안 함"
            : unavailableStatus}
          .
        </p>
      </section>
      {status && status.deviceCount > 0 && (
        <div className="device-actions">
          <p>
            내 계정에 연결된 기기의 접근을 모두 종료하고 연결 키도 폐기합니다. 다시 사용하려면 새 연결 키로 페어링해야
            합니다.
          </p>
          <button
            type="button"
            className="button secondary small"
            disabled={revoking || busy}
            onClick={() => void revokeAll()}
          >
            {revoking ? "연결 해제 중…" : "내 모든 기기 연결 해제"}
          </button>
        </div>
      )}
      {status && (
        <div className="device-actions" role="group" aria-labelledby="delete-conversations-title">
          <div>
            <p id="delete-conversations-title">
              이 계정의 대화 기록(음성 입력 텍스트, Dot 답변, 알림 메시지)을 서버에서 바로 삭제합니다. 기기 연결과 Dot
              구독은 유지됩니다.
            </p>
            {confirmingDelete && (
              <p ref={deletePrompt} tabIndex={-1}>
                삭제하면 되돌릴 수 없습니다. 이미 ChatGPT(Dot)나 Soniox로 전달된 내용, 휴대폰에 이미 표시된 내용은 이
                서버에서 지울 수 없습니다. 정말 삭제할까요?
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
                {deleting ? "삭제 중…" : "대화 기록 영구 삭제"}
              </button>
              <button type="button" className="button secondary small" disabled={deleting} onClick={cancelDelete}>
                취소
              </button>
            </div>
          ) : (
            <button ref={deleteTrigger} type="button" className="button secondary small" onClick={startDelete}>
              대화 기록 삭제
            </button>
          )}
        </div>
      )}
      <section className="last-step">
        <span className="step">03</span>
        <div>
          <h3>G2에서 말하고, 답변 확인하기</h3>
          <p>
            두 연결과 Dot 구독을 마치면 Even Hub 앱에서 말하거나 입력하세요. Dot이 받은 입력에 답하면 G2 화면에
            표시되도록 설계되어 있습니다. 실제 클라우드 Dot의 구독 등록은 확인되었고, 직접 실행한 MCP 테스트 메시지의 G2
            표시는 확인됨; 클라우드 Dot 자동 응답과 Mac-off 음성 왕복은 미검증.
          </p>
        </div>
        <span className="pending-badge">Mac 없는 왕복 검증 대기</span>
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
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => Promise<void>;
}) {
  const id = label === "Even Hub 서버 주소" ? "server-address" : "mcp-address";
  return (
    <div className="address-field">
      <label htmlFor={id}>{label}</label>
      <div className="code-row">
        <input id={id} readOnly value={value} placeholder="서버 주소 확인 중" />
        <button
          type="button"
          className="button secondary small"
          aria-label={`${label} 복사`}
          disabled={!value}
          onClick={() => void onCopy(value)}
        >
          복사
        </button>
      </div>
    </div>
  );
}
