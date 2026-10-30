/** What the G2 body says before any reply or notice: the next setup step, whether or not Hey dots is on. */
export function idleBody(state: { restored: boolean; connected: boolean; transcriber: boolean }): string {
  if (!state.restored) return "Dots Lens for G2 · 저장된 연결을 확인하는 중입니다.";
  if (!state.connected) return "Dots Lens for G2 · 휴대폰 앱에서 서버 주소와 연결 키를 입력해 연결하세요.";
  if (!state.transcriber)
    return "Dots Lens for G2 · 음성으로 질문하려면 휴대폰 앱에 본인 Soniox 키를 입력하세요. 직접 입력해 전송할 수도 있습니다.";
  return "Dots Lens for G2 · 길게 누른 채 질문을 말하고 손을 떼세요.";
}

/** Header feedback when a G2 scroll cannot move to another message; the body is left as it is. */
export function edgeNote(count: number, delta: number): string {
  if (!count) return "받은 답변 없음";
  return delta < 0 ? "첫 답변입니다" : "마지막 답변입니다";
}

/**
 * Asks the host for its exit confirmation (`shutDownPageContainer(1)`). The session keeps running until the host
 * reports the exit, because the user may cancel. While one request is pending another is not sent.
 */
export class ExitRequest {
  private pending = false;
  private readonly shutDown: () => Promise<boolean>;

  constructor(shutDown: () => Promise<boolean>) {
    this.shutDown = shutDown;
  }

  /** Resolves to whether the host accepted the request, or `undefined` when one was already pending. */
  async request(): Promise<boolean | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try {
      return await this.shutDown();
    } catch {
      return false;
    } finally {
      this.pending = false;
    }
  }
}
