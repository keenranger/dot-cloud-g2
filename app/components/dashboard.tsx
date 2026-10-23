"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  deviceCount: number;
  subscribed: boolean;
  pendingCount: number;
  sttConfigured: boolean;
  eventTransport: "unverified";
};
type Pairing = {
  code: string;
  expiresAt: string;
};
const dotPrompt = `G2 Bridge 플러그인의 "utterance.created" 이벤트를 session "g2"로 구독해 줘. 새 음성 입력을 받으면 한국어로 답하고, reply_to_g2 도구에 받은 것과 동일한 utterance_id와 한국어 답변 text를 보내 줘. 이벤트 전달이 실제로 확인되기 전에는 연결되었다고 말하지 마.`;

export default function Dashboard({ displayName }: { displayName: string }) {
  const [origin, setOrigin] = useState("");
  const [revoking, setRevoking] = useState(false);
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
        <StatusItem
          label="음성 인식"
          value={status ? (status.sttConfigured ? "서버 설정됨" : "서버 설정 필요") : unavailableStatus}
        />
      </div>
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
      {status && !status.sttConfigured && (
        <div className="notice">
          <strong>음성 인식 서버 설정이 필요합니다.</strong>
          <p>
            서버 관리자가 STT 자격 증명을 설정해야 G2의 음성을 텍스트로 바꿀 수 있습니다. 이 화면에는 API 키를 입력하지
            마세요.
          </p>
        </div>
      )}
      {status && status.deviceCount > 0 && (
        <div className="device-actions">
          <p>내 계정에 연결된 기기의 접근을 모두 종료합니다. 다시 사용하려면 새 코드로 페어링해야 합니다.</p>
          <button type="button" className="button secondary small" disabled={revoking} onClick={() => void revokeAll()}>
            {revoking ? "연결 해제 중…" : "내 모든 기기 연결 해제"}
          </button>
        </div>
      )}
      <section className="last-step">
        <span className="step">03</span>
        <div>
          <h3>G2에서 말하고, 답변 확인하기</h3>
          <p>
            두 연결과 Dot 구독을 마치면 Even Hub 앱에서 입력하세요. Dot이 받은 입력에 답하면 G2 화면에 표시되도록
            설계되어 있습니다. 실제 Dot 이벤트 전달과 기기 왕복은 아직 검증되지 않았습니다.
          </p>
        </div>
        <span className="pending-badge">실기기 검증 대기</span>
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
