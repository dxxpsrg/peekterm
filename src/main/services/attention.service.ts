// 트레이 작업 상태 표시 관리.
// CLI 에이전트(Claude Code 등)의 작업 상태를 메뉴바 아이콘으로 알린다:
//   - idle   : 평상시 기본 아이콘
//   - working: 기본색 ↔ 흐림으로 깜빡임(작업 진행 중). 창 가시성과 무관하게 항상 깜빡인다.
//   - done   : 코랄로 고정(작업 완료). 단, '완료 시점에 창을 보고 있지 않을 때'만 켠다.
//
// 설계 의도: 트레이/창 모듈이 서로를 import하지 않고 이 서비스만 바라보게 해 순환 의존을 피한다.
// 그래서 electron은 'import type'으로만 가져오고, 창 가시성은 외부에서 주입받는다.
import type { Tray, NativeImage } from 'electron';

// 트레이에 쓰는 세 가지 아이콘.
interface TrayIcons {
  normal: NativeImage; // 평상시/깜빡임 '켜짐' 프레임(기본 단색 템플릿).
  dim: NativeImage; // 깜빡임 '꺼짐' 프레임(같은 모양의 흐린 템플릿).
  attention: NativeImage; // 완료 알림(코랄).
}

// 트레이 인스턴스 참조(메인에서 1회 등록)와 아이콘들을 보관한다.
let trayRef: Tray | null = null;
let icons: TrayIcons | null = null;
// 완료 시점에 창을 보고 있는지 판단하는 주입형 게터(기본값: 안 보임).
let isWindowVisible: () => boolean = () => false;

// 트레이 표시 상태와 타이머들.
type TrayState = 'idle' | 'working' | 'done';
let trayState: TrayState = 'idle';
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let blinkOn = false;
// 완료 디바운스 타이머: 스피너가 일정 시간 안 보이면 '완료'로 확정한다.
let doneTimer: ReturnType<typeof setTimeout> | null = null;

// 깜빡임 주기(ms). 너무 빠르면 산만하고 너무 느리면 '진행 중' 느낌이 약해진다.
const BLINK_INTERVAL_MS = 550;
// 완료 디바운스(ms). Claude는 작업 중에도 제목이 스피너↔비스피너로 오락가락하므로,
// 비스피너 제목 하나로 즉시 완료 판정하면 깜빡임이 끊긴다. 마지막 스피너 이후 이 시간만큼
// 스피너가 다시 안 나타나야 비로소 완료로 본다(작업 중 잠깐의 공백은 흡수).
const DONE_DEBOUNCE_MS = 1500;

/** createTray 직후 트레이 인스턴스와 아이콘 묶음을 등록한다. */
export function registerTrayForAttention(tray: Tray, trayIcons: TrayIcons): void {
  trayRef = tray;
  icons = trayIcons;
}

/** 완료 시점에 창을 보고 있는지 판단하는 함수를 주입한다(순환 의존 회피). */
export function setVisibilityGetter(fn: () => boolean): void {
  isWindowVisible = fn;
}

// 안전하게 아이콘을 교체한다(빈 이미지면 건너뜀).
function applyIcon(icon: NativeImage | null): void {
  if (trayRef && icon && !icon.isEmpty()) trayRef.setImage(icon);
}

// 작업 중 깜빡임 시작: 기본 ↔ 흐림을 번갈아 표시한다(기본색 점멸, 코랄 아님).
function startBlinking(): void {
  stopBlinking();
  blinkOn = false;
  blinkTimer = setInterval(() => {
    blinkOn = !blinkOn;
    applyIcon(blinkOn ? icons?.normal ?? null : icons?.dim ?? null);
  }, BLINK_INTERVAL_MS);
}

function stopBlinking(): void {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
}

function clearDoneTimer(): void {
  if (doneTimer) {
    clearTimeout(doneTimer);
    doneTimer = null;
  }
}

/**
 * 트레이 상태를 전환하고 아이콘에 반영한다.
 * working → 깜빡임, done → 코랄 고정, idle → 평상시 아이콘.
 * 같은 상태면 무시해 불필요한 갱신/타이머 재시작을 막는다.
 */
export function setTrayState(next: TrayState): void {
  if (trayState === next) return;
  trayState = next;
  if (next === 'working') {
    startBlinking();
    return;
  }
  // working이 아니면 깜빡임과 대기 중인 완료 타이머를 멈추고 정적 아이콘으로 고정한다.
  stopBlinking();
  clearDoneTimer();
  applyIcon(next === 'done' ? icons?.attention ?? null : icons?.normal ?? null);
}

/**
 * 작업 완료 처리. 완료 시점에 창을 보고 있으면 알릴 필요가 없으므로 평상시로 두고,
 * 보고 있지 않을 때만 코랄로 알린다.
 */
export function markDone(): void {
  setTrayState(isWindowVisible() ? 'idle' : 'done');
}

/**
 * 완료(코랄) 표시를 사용자가 인지했을 때 평상시로 되돌린다(창 열기/입력 시 호출).
 * 작업 중(working)에는 아무 것도 하지 않는다 — 터미널 자동 응답이 깜빡임을 꺼뜨리는 것을 막는다.
 */
export function acknowledgeIfDone(): void {
  if (trayState === 'done') setTrayState('idle');
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

// 완료 알림으로 간주할 OSC '데스크톱 알림' 시퀀스.
// Claude Code 등은 알림 채널이 auto일 때, 상속한 TERM_PROGRAM에 따라 순수 BEL이 아니라
// OSC 알림 시퀀스를 보낸다. 채널별 코드: OSC 9(iTerm2 등), OSC 99(kitty),
// OSC 777;notify(urxvt), OSC 1337(iTerm2 전용). 모두 BEL 또는 ST(ESC \)로 종결한다.
// 주의: OSC 9;4는 '진행률(progress)' 갱신이므로 (?!;4)로 제외해 매 진행마다 점이 켜지는 오탐을 막는다.
//       제목/아이콘 변경 OSC(0/1/2)도 매칭 대상이 아니라 자연히 제외된다.
const OSC_NOTIFY = /\x1b\](?:9(?!;4)|99|777;notify|1337);[^\x07\x1b]*(?:\x07|\x1b\\)/;

/**
 * PTY 출력 청크에 '완료 알림' 신호가 들어있는지 검사한다.
 * 순수 BEL(terminal_bell 채널)과 OSC 데스크톱 알림 시퀀스를 모두 인정해,
 * 실행 환경(개발/빌드)에 따라 신호 방식이 달라져도 점이 확실히 켜지게 한다.
 */
export function containsAttentionSignal(data: string): boolean {
  if (OSC_NOTIFY.test(data)) return true; // OSC 알림 채널(auto가 터미널을 보고 선택)
  return containsBell(data); // terminal_bell 채널(순수 BEL)
}

// ── 청크 경계 보정(감지 경로 전용) ───────────────────────────────────────
// PTY 출력은 임의 지점에서 청크로 쪼개진다. 우리가 감지하는 OSC 시퀀스(제목 스피너·알림 등)가
// 두 청크에 걸치면 어느 쪽에도 완전한 시퀀스가 없어 한 프레임 놓칠 수 있다. 끝에 '종결되지 않은
// ESC 시퀀스'가 있으면 그 부분만 다음 청크로 넘겨 이어붙인다. 완결 시퀀스/일반 텍스트는 넘기지
// 않으므로 중복 처리(double-fire)가 없다.
let carry = '';
const MAX_CARRY = 4096; // 비정상적으로 긴 미완성 시퀀스 방어(이 이상이면 캐리하지 않고 흘려보냄).

export function assembleForDetection(chunk: string): string {
  let data = carry + chunk;
  carry = '';
  const lastEsc = data.lastIndexOf('\x1b');
  if (lastEsc !== -1) {
    const tail = data.slice(lastEsc);
    const loneEsc = tail === '\x1b'; // 끝이 ESC 한 글자(시퀀스 시작 직전 잘림).
    // OSC(ESC ])인데 종결자(BEL 또는 ST=ESC\)가 아직 없으면 미완성으로 본다.
    const unterminatedOsc = tail.startsWith('\x1b]') && !/[\x07]|\x1b\\/.test(tail.slice(2));
    if ((loneEsc || unterminatedOsc) && tail.length <= MAX_CARRY) {
      carry = tail; // 미완성 꼬리만 다음 청크로 이월.
      data = data.slice(0, lastEsc);
    }
  }
  return data;
}

// ── 제목(title) 스피너 기반 작업 상태 추적 ────────────────────────────────
// 가장 신뢰도 높은 신호다. Claude Code(v2.1.6+)는 작업 중(thinking)일 때 터미널 제목을
// '브라유 스피너(⠋⠙⠹…) + Claude Code'로 매 프레임 갱신하고, 완료/대기 상태로 돌아오면
// 스피너 없는 제목('✳ Claude Code')으로 되돌린다. CMUX 등 에이전트 멀티플렉서도 같은 방식으로
// 상태를 읽는다. Claude의 알림 채널/포커스 설정과 무관하며, npm 등 다른 스피너형 장기 작업도 잡는다.
//
// 주의: 작업 중에도 제목이 스피너↔비스피너로 오락가락한다. 그래서 '비스피너 제목 = 즉시 완료'로 보면
// 깜빡임이 churn으로 끊긴다. 대신 '스피너가 보이면 작업 중', '스피너가 DONE_DEBOUNCE_MS 동안
// 다시 안 보이면 완료'로 판정해, 작업 중 잠깐의 공백을 흡수한다.

// OSC 0/1/2(제목·아이콘 설정) 시퀀스에서 제목 텍스트만 추출한다. BEL 또는 ST(ESC \)로 종결.
const OSC_TITLE = /\x1b\][0-2];([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
// 스피너에 쓰이는 브라유 점 문자 범위(U+2800–U+28FF). 완료 상태의 '✳'(U+2733)는 범위 밖이라 제외된다.
const SPINNER = /[⠀-⣿]/;

/** PTY 출력 청크의 OSC 제목에 스피너(브라유) 글리프가 들어있는지 검사한다(순수 함수). */
export function hasSpinnerTitle(data: string): boolean {
  for (const match of data.matchAll(OSC_TITLE)) {
    if (SPINNER.test(match[1])) return true;
  }
  return false;
}

/**
 * PTY 출력 청크를 받아 트레이 작업 상태를 갱신한다.
 * 스피너가 보이면 즉시 working(깜빡임)으로 두고 완료 디바운스를 리셋한다.
 * 디바운스가 끝날 때까지(=스피너가 더 안 보이면) done(코랄)으로 확정한다.
 */
export function updateFromOutput(data: string): void {
  if (!hasSpinnerTitle(data)) return; // 스피너가 없는 청크는 상태에 영향 없음.
  setTrayState('working'); // 작업 중 → 깜빡임(이미 working이면 무시).
  // 마지막 스피너 기준으로 완료 타이머를 재설정한다.
  clearDoneTimer();
  doneTimer = setTimeout(() => {
    doneTimer = null;
    markDone(); // 일정 시간 스피너가 안 보임 → 완료(창을 보고 있지 않으면 코랄).
  }, DONE_DEBOUNCE_MS);
}

/** 현재 트레이 표시 상태를 반환한다(테스트·진단용). */
export function getTrayState(): TrayState {
  return trayState;
}

/** 상태·타이머·가시성 게터를 초기화한다(주로 테스트에서 케이스 간 격리에 사용). */
export function resetTrayState(): void {
  stopBlinking();
  clearDoneTimer();
  trayState = 'idle';
  isWindowVisible = () => false;
  carry = ''; // 청크 경계 보정 버퍼도 초기화(테스트 케이스 간 격리).
}
