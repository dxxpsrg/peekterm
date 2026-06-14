// 트레이 완료 알림(점) 상태 관리.
// CLI 에이전트(Claude/Codex 등)가 작업을 마치고 보내는 터미널 벨(BEL)을 감지하면
// 메뉴바 트레이 아이콘 옆에 점(●)을 띄워 사용자에게 완료를 알린다.
//
// 설계 의도: 트레이/창 모듈이 서로를 import하지 않고 이 서비스만 바라보게 해
// 순환 의존을 피한다. 그래서 electron은 'import type'으로만 가져온다
// (런타임 의존이 사라져 containsBell을 vitest에서 그대로 테스트할 수 있음).
import type { Tray } from 'electron';

// 트레이 인스턴스 참조(메인에서 1회 등록)와 현재 알림 상태를 보관한다.
let trayRef: Tray | null = null;
let active = false;

/** createTray 직후 트레이 인스턴스를 등록한다. */
export function registerTrayForAttention(tray: Tray): void {
  trayRef = tray;
}

/**
 * 완료 알림 점을 켜고 끈다.
 * setTitle은 macOS 메뉴바 전용 API이며, peekterm은 macOS 전용 앱이라 안전하다.
 * 상태가 같으면 setTitle 재호출을 생략해 불필요한 갱신을 막는다.
 */
export function setAttention(on: boolean): void {
  if (active === on) return;
  active = on;
  trayRef?.setTitle(on ? ' ●' : '');
}

/**
 * PTY 출력 청크에 '순수 벨(BEL, \x07)'이 들어있는지 검사한다.
 *
 * 주의: \x07은 OSC 시퀀스(ESC ] ... BEL)의 종결자로도 쓰인다. CLI 도구들은
 * 창 제목·작업 상태를 OSC로 자주 갱신하므로, 단순 includes로 검사하면
 * 제목이 바뀔 때마다 오탐이 난다. 따라서 OSC 시퀀스(ESC ] ... (BEL | ST))를
 * 먼저 제거한 뒤 남은 곳에 \x07이 있는지 확인한다.
 *
 * 한계: PTY 데이터가 청크로 쪼개져 OSC 시퀀스가 두 청크에 걸치면 드물게
 * 오탐이 날 수 있다(가끔 점이 한 번 더 켜지는 정도). 1차 구현에서는 허용한다.
 */
export function containsBell(data: string): boolean {
  const withoutOsc = data.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
  return withoutOsc.includes('\x07');
}
