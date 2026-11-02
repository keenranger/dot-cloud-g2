import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Korean translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.ko.dashboard;
// The companion's disconnect button (even-app/src/messages/ko.ts).
const companionDisconnect = "연결 해제 · 저장된 토큰 지우기";

export const description =
  "Lens MCP for G2가 무엇을 처리하고, 어디로 보내며, 릴레이가 얼마나 보관하고, 어떻게 지울 수 있는지 안내합니다.";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">운영자</h2>
        <p>
          Lens MCP for G2는 <strong>keenranger</strong>가 공개한 독립 프로젝트입니다. Even Hub를 통해 배포되는 Even
          Realities G2 안경용 컴패니언 앱과 <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>의 릴레이 웹사이트로 이루어져
          있습니다. 두 가지가 함께 G2를 본인의 ChatGPT Dot에 연결합니다. Even Realities, OpenAI, Soniox의 공식 제품이
          아닙니다.
        </p>
        <p>
          문의 및 개인정보 관련 요청: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">마이크 음성</h2>
        <ul>
          <li>컴패니언 앱은 G2 마이크만 사용합니다. 수동 녹음은 최대 30초입니다.</li>
          <li>
            컴패니언 앱이 페어링되고 음성 키가 설정되면 “Hey dots” 듣기가 기본으로 켜집니다. 컴패니언 앱에서 끌 수
            있으며, 선택은 휴대폰에 기억됩니다. 켜져 있고 컴패니언 앱이 실행 중인 동안에는 호출어를 감지할 수 있도록 G2
            마이크가 계속 열려 있습니다.
          </li>
          <li>
            호출어 감지는 휴대폰에서 이루어집니다. 호출어 이전에 들린 음성은 휴대폰의 짧고 크기가 제한된 버퍼에만
            보관되며 어디로도 전송되지 않습니다.
          </li>
          <li>
            호출어 이후의 말이나 수동 녹음은 본인의 Soniox API 키로 휴대폰에서 Soniox로 바로 스트리밍되어 텍스트로
            변환됩니다. Soniox는 그 음성을 본인과 Soniox 사이의 약정에 따라 처리합니다.
          </li>
          <li>
            저희 릴레이는 원본 음성을 절대 받지 않습니다. 서버 측 음성 인식 엔드포인트는 비활성화되어 있으며, 음성을
            읽기 전에 요청을 거부합니다.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">본인의 Soniox API 키</h2>
        <p>
          Soniox 키는 본인이 휴대폰에서 입력합니다. 기본적으로 현재 앱 세션 동안 메모리에만 보관됩니다. 기억하기를
          선택하면 그 휴대폰의 Even Hub 앱 저장소에 저장됩니다. 언제든 지우거나 바꿀 수 있습니다. 키는 Soniox로만
          전송되며 저희 릴레이로는 절대 전송되지 않습니다. 컴패니언 앱은 기억된 키를 따로 암호화하지 않으며, 그 안전성은
          휴대폰과 Even 앱에 달려 있습니다.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">메시지, 음성 인식 결과, 답변</h2>
        <p>
          입력한 메시지, 확정된 음성 인식 결과, Dot의 답변, 그리고 Dot이 스스로 보내는 메시지는 G2와 ChatGPT 사이에서
          전달될 수 있도록 릴레이에 저장됩니다. 이와 함께 릴레이는 계정 식별자, 메시지와 기기 식별자, 시각, 전달 상태를
          저장합니다. Dot이 스스로 보내는 메시지는 내 계정에 페어링된 모든 기기로 전달됩니다. 이 메시지에는 본인이
          말하거나 입력하기로 한 어떤 개인정보든 담길 수 있습니다.
        </p>
        <p>
          컴패니언 앱은 최근 답변을 최대 100개까지 휴대폰 메모리에 보관하고, “Hey dots”와 음성 자동 전송에 대한 선택을
          Even Hub 앱 저장소에 기억합니다.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">로그인, 연결 키, 기기</h2>
        <ul>
          <li>
            릴레이 웹사이트에는 ChatGPT로 로그인합니다. 호스팅 플랫폼이 릴레이에 계정 식별자를 전달하며, 이를 통해 내
            기록이 다른 사용자의 기록과 분리됩니다. ChatGPT 세션은 컴패니언 앱으로 복사되지 않습니다.
          </li>
          <li>
            계정마다 연결 키는 최대 하나입니다. 만료되지 않으며 여러 기기를 페어링할 수 있습니다. 릴레이는 키를 찾기
            위한 SHA-256 해시와, 로그인한 본인이 나중에 다시 볼 수 있도록 서버 비밀값으로 AES-256-GCM 암호화한 키 자체를
            저장합니다. 이 암호화는 데이터베이스만 유출되는 경우를 막기 위한 것이며, 서버나 그 비밀값이 침해되는 경우는
            막지 못합니다.
          </li>
          <li>
            대시보드는 기본적으로 키를 가려서 보여 줍니다. “{d.showKey}”를 누른 뒤에만 표시되고, 표시된 동안에만 복사할
            수 있으며, 페이지 메모리에만 보관되고 브라우저 저장소에는 절대 저장되지 않습니다.
          </li>
          <li>
            새 키를 만들면(“{d.createNewKey}”) 이전 키가 즉시 대체되고, 폐기하면(“{d.revokeKey}”) 키가 삭제됩니다. 두
            경우 모두 이미 페어링된 기기는 페어링이 유지됩니다. “{d.revokeAll}”는 키를 삭제하고 내 모든 기기의 연결을
            해제합니다.
          </li>
          <li>
            연결 키가 도입되기 전에 페어링된 기기는 계속 페어링되어 있습니다. 그 전에 쓰던 짧은 유효 기간의 연결 코드는
            다시 볼 수 없었으며 이미 만료되었습니다.
          </li>
          <li>
            기기를 페어링하면 기기 기록과 기기 토큰이 만들어집니다. 릴레이는 토큰을 해시로만 저장합니다. 컴패니언 앱은
            토큰과 릴레이 주소를 휴대폰의 Even Hub 앱 저장소에 저장합니다.
          </li>
          <li>
            Dot이 이벤트를 구독하면 릴레이는 구독 정보, 콜백 주소, 서명 비밀값을 저장합니다. 구독은 기본 1시간(1분에서
            1일 사이) 유지되며 취소할 수 있습니다.
          </li>
          <li>릴레이는 남용을 막기 위해 짧은 기간 동안 요청 횟수를 기록합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">정보가 전달되는 곳</h2>
        <ul>
          <li>
            <strong>저희 릴레이</strong>(이 프로젝트가 사용하는 Sites 플랫폼에서 호스팅): 위에서 설명한 텍스트, 식별자,
            연결 기록. 음성이나 Soniox 키는 절대 포함되지 않습니다.
          </li>
          <li>
            <strong>Soniox</strong>(<code>stt-rt.soniox.com</code>): 음성 인식을 위해 보낸 음성과 본인의 키.
          </li>
          <li>
            <strong>ChatGPT(내 Dot)</strong>와 Dot이 등록한 MCP 콜백: 내 메시지와 음성 인식 결과, 그리고 Dot이 돌려주는
            답변.
          </li>
          <li>
            <strong>Even Realities</strong> 앱과 휴대폰 운영체제: 컴패니언 앱을 실행하고, 안경의 마이크와 화면을
            연결하며, Even Hub 앱 저장소를 보관합니다.
          </li>
        </ul>
        <p>
          각 제공업체는 자체 약관과 정책에 따라 데이터를 처리합니다. 이 프로젝트의 컴패니언 앱과 릴레이 코드에는 분석
          도구나 광고 도구가 없습니다. 제공업체가 데이터, 로그, 백업을 어디에 보관하는지는 감사하지 않았습니다.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">릴레이의 대화 보관 기간</h2>
        <ul>
          <li>
            <strong>30일 기한.</strong> 메시지, 음성 인식 결과, 답변이 만들어진 지(UTC) 30일이 지나면, 실제로
            삭제되었는지와 관계없이 릴레이는 더 이상 이를 보여 주거나 전달하거나 재시도하거나 응답하지 않습니다.
          </li>
          <li>
            <strong>지금 지우기.</strong> 릴레이 웹사이트에 로그인해 “{d.deleteForever}”로 모든 대화를 한 번에 지울 수
            있습니다. 내용은 즉시 삭제됩니다. 늦게 도착한 재시도가 다시 저장하지 못하도록 릴레이는 지운 항목마다 내용이
            없는 짧은 표시만 남기며, 컴패니언 앱은 다음에 답변을 확인할 때 화면의 기록을 비웁니다. 기기, 연결 키, Dot
            구독에는 영향이 없습니다.
          </li>
          <li>
            <strong>실제 삭제.</strong> 매일 한국 시간(Asia/Seoul) 03:00에 정리 작업이 예약되어 있습니다. 한 번 실행할
            때마다 30일 기한이 지난 기록을 최대 20,000건까지 영구 삭제하며, 그보다 많으면 다음 실행을 기다립니다. 따라서
            삭제는 기한 후 약 하루 안에 이루어질 수 있고, 실행이 실패하거나 처리할 양이 쌓이면 더 늦어질 수 있습니다.
            예약된 정리 작업이 스스로 실행되는 것은 아직 확인되지 않았으므로, 특정 날짜의 삭제를 약속하지 않습니다. 새
            메시지가 제출될 때 만료된 기록 일부가 더 일찍 삭제될 수도 있습니다.
          </li>
          <li>지우기나 정리 작업 후 남는 내용 없는 표시는 30일 동안 보관된 뒤 같은 정리 작업으로 제거됩니다.</li>
          <li>
            연결 키는 본인이 바꾸거나 폐기하거나 모든 기기의 연결을 해제할 때까지 보관됩니다. 만료된 코드, 구독, 요청
            횟수 기록은 만료되면 더 이상 쓰이지 않지만 정해진 일정에 따라 삭제되지는 않습니다.
          </li>
        </ul>
        <p>
          모든 기기의 연결을 해제하면 기기의 접근 권한은 없어지지만 대화는 삭제되지 않습니다. 대화를 지우려면 “
          {d.deleteForever}”를 사용하세요. 컴패니언 앱의 “{companionDisconnect}”는 그 휴대폰에 저장된 토큰만 지웁니다.
        </p>
        <p>
          이미 ChatGPT나 Soniox로 전송된 내용, 이미 휴대폰이나 안경에 표시된 내용은 릴레이가 삭제할 수 없습니다.
          제공업체가 보관하는 사본, 호스팅 및 제공업체의 로그와 백업은 이 약속에 포함되지 않습니다.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">휴대폰 잠금과 백그라운드 사용</h2>
        <p>
          안경 세션이 유지되는 동안 컴패니언 앱은 휴대폰이 잠겨 있거나 Even 앱이 백그라운드에 있어도 “Hey dots” 듣기,
          녹음, 답변 표시를 계속하도록 설계되어 있습니다. 그때도 계속 실행되는지는 Even 앱과 휴대폰 운영체제에 달려
          있습니다. 컴패니언 앱을 닫거나 연결을 해제하거나 “Hey dots”를 끄면 듣기가 멈춥니다.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">보안</h2>
        <p>
          컴패니언 앱은 HTTPS와 보안 WebSocket으로만 릴레이 및 Soniox와 통신합니다. 기기 접근에는 기기별 토큰을 쓰고,
          계정 작업에는 ChatGPT 로그인이 필요하며 본인의 기록으로 제한됩니다. 키와 페어링 요청에는 횟수 제한이 있습니다.
          완벽하게 안전한 시스템은 없으며, 이러한 조치가 모든 오용을 막는다고 보장할 수 없습니다.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">변경 및 연락처</h2>
        <p>
          이 방침이 바뀌면 변경된 내용과 시행일을 이 페이지에 게시합니다. 내 정보에 관한 문의나 요청은{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 이메일을 보내 주세요.{" "}
          <Link href={policyPath("terms", "ko")}>{copy.ko.page.terms}</Link>도 함께 확인해 주세요.
        </p>
      </section>
    </>
  );
}
