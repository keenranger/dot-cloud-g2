import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Korean translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.ko.page.privacy;

export const description = "Lens MCP for G2가 제공하는 것, 이용자에게 필요한 것, 그리고 한계를 안내합니다.";

export default function Body() {
  return (
    <>
      <p>
        이 약관은 <strong>keenranger</strong>가 공개한 Lens MCP for G2 컴패니언 앱과{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>의 릴레이 웹사이트에 적용됩니다.{" "}
        <Link href={policyPath("privacy", "ko")}>{privacy}</Link>과 함께 읽어 주세요.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. 서비스</h2>
        <p>
          Lens MCP for G2는 MCP를 통해 Even Realities G2 안경을 본인의 ChatGPT Dot에 연결합니다. 말하거나 입력한 내용을
          Dot에 전달하고 Dot의 답변을 안경에 보여 줍니다. 범용 MCP 클라이언트가 아니며, 모든 MCP 서버나 에이전트와
          동작한다고 약속하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. 필요한 것</h2>
        <ul>
          <li>G2 안경과 호환되는 Even 앱(버전 2.2.10 이상)이 설치된 휴대폰.</li>
          <li>네트워크 연결, 그리고 릴레이에 Dot이 연결된 ChatGPT 계정.</li>
          <li>음성 입력을 쓰려면 본인의 Soniox 계정과 API 키.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. 계정, 키, 요금</h2>
        <p>
          서비스와 함께 쓰는 계정과 키는 본인이 관리하며, 이를 사용할 권한이 있어야 합니다. ChatGPT, Soniox, Even
          Realities 서비스는 각자의 약관에 따라 제공되며, 음성 인식을 위한 Soniox 사용료 등 그로 인한 요금은 본인이
          부담합니다. 앱에는 유료 음성 인식 크레딧이 포함되어 있지 않으며, 제공업체 계정을 대신 만들어 주지 않습니다.
        </p>
        <p>
          연결 키는 비밀번호처럼 다뤄 주세요. 키를 가진 사람은 누구든 본인이 새 키를 만들거나 키를 폐기할 때까지 새
          기기를 내 계정에 페어링할 수 있습니다. 릴레이 웹사이트에서 내 모든 기기의 연결을 해제할 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. 한계와 안전한 사용</h2>
        <ul>
          <li>음성 인식 결과에는 오류가 있을 수 있고, Dot의 답변이 틀릴 수 있습니다. 믿고 따르기 전에 확인하세요.</li>
          <li>응급 상황에 쓰거나, 의료·법률·금융 전문가의 조언을 대신하는 용도로 쓰지 마세요.</li>
          <li>안전한 상황에서만 안경을 보거나 조작하세요.</li>
          <li>
            휴대폰이 잠겼거나 백그라운드에 있을 때의 동작은 Even 앱과 휴대폰 운영체제에 달려 있으며 보장되지 않습니다.
          </li>
          <li>이 프로젝트는 독립 프로젝트입니다. 변경되거나 중단되거나 종료될 수 있습니다.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. 허용되는 사용</h2>
        <p>
          법을 어기거나, 다른 사람의 기록이나 기기에 접근하거나, 릴레이 또는 릴레이가 연결하는 서비스를 방해하는 데
          서비스를 쓰지 마세요.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. 이용 중단</h2>
        <p>
          <Link href={policyPath("privacy", "ko")}>{privacy}</Link>에 설명된 대로, 언제든 “Hey dots”를 끄고, 녹음을
          멈추고, Soniox 키를 지우고, 컴패니언 앱의 연결을 해제하고, 연결 키를 폐기하고, 모든 기기의 연결을 해제하고,
          대화를 지울 수 있습니다. 다른 제공업체가 보관하는 데이터는 계속 해당 업체의 관리 방식을 따릅니다.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. 독립성</h2>
        <p>
          이 프로젝트는 Even Realities, OpenAI, Soniox와 제휴 관계가 없으며 이들의 보증을 받지 않았습니다. 이들의 이름은
          해당 제품과 서비스와의 호환성을 설명하기 위해서만 사용합니다.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. 변경 및 연락처</h2>
        <p>
          이 약관이 바뀌면 변경된 내용과 시행일을 이 페이지에 게시합니다. 문의:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
