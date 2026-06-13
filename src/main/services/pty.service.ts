// PTY(의사 터미널) 서비스.
// 단일 zsh 세션을 main 프로세스에 상주시켜, 창이 숨겨져도 작업이 백그라운드에서 유지되게 한다.
import * as pty from 'node-pty';
import os from 'os';

let ptyProcess: pty.IPty | null = null;
let onDataCb: ((data: string) => void) | null = null;
let onExitCb: ((code: number) => void) | null = null;

// 사용자의 기본 셸을 사용하되, 미설정 시 zsh로 폴백.
const shell = process.env.SHELL || 'zsh';

// 셸 프로세스를 생성하고 출력/종료 콜백을 연결한다.
function spawn(): void {
  ptyProcess = pty.spawn(shell, ['--login'], {
    // TERM=xterm-256color로 설정해 셸에 256색 지원을 알린다.
    // 'xterm-color'는 terminfo상 8색(0~7)만 지원하므로, zsh-autosuggestions의
    // 기본 제안색(fg=8, ANSI 8번 = 회색)이 범위를 벗어나 적용되지 않고
    // 전경색(흰색)으로 떨어지는 문제가 있었다. xterm.js는 256색을 지원한다.
    name: 'xterm-256color',
    cols: 80, // 초기값 — 렌더러가 fit 후 resize로 정확히 맞춘다.
    rows: 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData((data) => onDataCb?.(data));
  ptyProcess.onExit(({ exitCode }) => {
    ptyProcess = null;
    onExitCb?.(exitCode);
  });
}

// 앱 시작 시 1회 호출 — 이미 떠 있으면 무시(중복 생성 방지).
export function init(): void {
  if (!ptyProcess) spawn();
}

export function onData(cb: (data: string) => void): void {
  onDataCb = cb;
}

export function onExit(cb: (code: number) => void): void {
  onExitCb = cb;
}

// 렌더러 키 입력을 셸로 전달.
export function write(data: string): void {
  ptyProcess?.write(data);
}

// 터미널 크기 동기화 — 0 이하 값은 무시(레이아웃 미완성 시 방어).
export function resize(cols: number, rows: number): void {
  if (ptyProcess && cols > 0 && rows > 0) {
    try {
      ptyProcess.resize(cols, rows);
    } catch {
      // resize는 프로세스 종료 직후 호출되면 throw할 수 있어 무시한다.
    }
  }
}

// 앱 종료 시 셸 프로세스 정리.
export function destroy(): void {
  ptyProcess?.kill();
  ptyProcess = null;
}
