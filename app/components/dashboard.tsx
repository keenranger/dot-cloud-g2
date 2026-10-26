"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
type Pairing = {
  code: string;
  expiresAt: string;
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
  // Set when an erase settles so focus moves only once React has re-enabled or replaced the controls.
  const focusAfterDelete = useRef<"success" | "failure" | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (response.status === 401) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      if (!response.ok) throw new Error("연결 상태를 불러오지 못했습니다. 다시 확인해 주세요.");
      setStatus((await response.json()) as Status);
      setError("");
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했습니다.");
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    // Read the browser URL only after mounting to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    // Hydrate the dashboard from the authenticated server after mounting.
    void refresh();
  }, [refresh]);
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

  async function createPairing() {
    setBusy(true);
    setError("");
    setMessage("");
    setPairing(null);
    try {
      const response = await fetch("/api/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("연결 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPairing((await response.json()) as Pairing);
      setMessage("새 연결 코드를 만들었습니다. Even Hub 앱에 입력해 주세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "연결 코드를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function revokeAll() {
    setRevoking(true);
    setError("");
    try {
      const response = await fetch("/api/devices/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!response.ok) throw new Error("기기 연결을 해제하지 못했습니다.");
      setMessage("내 모든 기기 연결을 해제했습니다. 다시 사용하려면 새 코드로 페어링해 주세요.");
      setPairing(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기기 연결을 해제하지 못했습니다.");
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
      setMessage("복사했습니다.");
    } catch {
      setMessage("자동 복사를 사용할 수 없습니다. 표시된 내용을 직접 선택해 복사해 주세요.");
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
          onClick={() => {
            setRefreshing(true);
            void refresh();
          }}
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
            아래 서버 주소와 연결 코드를 입력하세요. 안경이 휴대폰에 연결되어 있어야 합니다.
          </p>
          <AddressField label="Even Hub 서버 주소" value={origin} onCopy={copy} />
          <p className="helper">코드는 한 번만 사용할 수 있습니다. 연결할 때 생성하세요.</p>
          <button type="button" className="button primary" disabled={busy} onClick={() => void createPairing()}>
            {busy ? "코드 만드는 중…" : pairing ? "새 연결 코드 만들기" : "연결 코드 만들기"}
          </button>
          {pairing && (
            <div className="pairing-result">
              <label htmlFor="pairing-code">Even Hub 연결 코드</label>
              <div className="code-row">
                <input id="pairing-code" readOnly value={pairing.code} autoComplete="off" spellCheck={false} />
                <button
                  className="button secondary small"
                  type="button"
                  aria-label="Even Hub 연결 코드 복사"
                  onClick={() => void copy(pairing.code)}
                >
                  복사
                </button>
              </div>
              <p>만료 시각: {new Date(pairing.expiresAt).toLocaleString("ko-KR")}</p>
            </div>
          )}
        </section>
        <section className="setup-card" aria-labelledby="dot-title">
          <span className="step">02</span>
          <h3 id="dot-title">연결 2: ChatGPT MCP 서버 추가</h3>
          <p>
            Dot과 이 서버를 잇는 연결로, Even Hub 연결 코드는 쓰지 않습니다. 이 사이트의 MCP 플러그인이 ChatGPT에
            설치되어 있어야 합니다. 없다면 데스크톱 브라우저의 ChatGPT 웹에서 아래 주소를 사용자 지정 MCP 서버로
            추가하고 설치하세요. 그다음 Dot에 아래 요청을 보내 이벤트 구독을 요청하세요. 같은 Dot을 모바일 앱에서도
            이어서 쓸 수 있지만, 구독 생성과 휴대폰 앱에서의 이벤트 전달은 아직 확인되지 않았습니다.
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
          <p>내 계정에 연결된 기기의 접근을 모두 종료합니다. 다시 사용하려면 새 코드로 페어링해야 합니다.</p>
          <button type="button" className="button secondary small" disabled={revoking} onClick={() => void revokeAll()}>
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
