import Link from "next/link";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="G2 Bridge 홈">
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          G2 Bridge
        </Link>
        <span className="header-note">EVEN HUB × CHATGPT</span>
        {user && (
          <a className="text-link" href={chatGPTSignOutPath()} target="_top">
            로그아웃
          </a>
        )}
      </header>
      <main id="main">
        <section className="intro">
          <p className="eyebrow">A SMALL BRIDGE, A BIGGER CONVERSATION</p>
          <h1>
            안경에서 말하고,
            <br />
            <span>Dot과 이어가세요.</span>
          </h1>
          <p className="intro-copy">
            내 Even G2의 음성을 ChatGPT 안의 내 Dot에 전하고,
            <br />
            답변을 다시 안경 화면으로 가져옵니다.
          </p>
          <div className="flow" aria-label="연결 경로">
            <span>Even G2</span>
            <span aria-hidden="true">→</span>
            <span>Even Hub</span>
            <span aria-hidden="true">→</span>
            <span>Dot</span>
            <span aria-hidden="true">→</span>
            <span>G2 화면</span>
          </div>
        </section>
        {user ? (
          <Dashboard displayName={user.displayName} />
        ) : (
          <section className="signin-panel" aria-labelledby="signin-title">
            <div>
              <p className="eyebrow">01 / 시작하기</p>
              <h2 id="signin-title">내 ChatGPT 계정으로 연결 준비</h2>
              <p>
                로그인하면 내 Dot과 G2를 위한 개인 연결 설정을 시작할 수 있습니다. Mac에 별도 프로그램을 설치할 필요가
                없습니다.
              </p>
            </div>
            <a className="button primary" href={chatGPTSignInPath("/")} target="_top">
              Sign in with ChatGPT <span aria-hidden="true">↗</span>
            </a>
          </section>
        )}
        <aside className="verification-note">
          <span className="status-dot" aria-hidden="true" />
          <p>
            <strong>연결 검증 진행 중</strong> · ChatGPT 로그인과 G2 페어링은 별개입니다. Dot 이벤트 수신과 실제 안경의
            음성·화면 왕복은 아직 검증되지 않았습니다.
          </p>
        </aside>
      </main>
      <footer>
        <span>G2 Bridge</span>
        <span>안경과 대화 사이, 필요한 연결만.</span>
      </footer>
    </div>
  );
}
