// 앱 전역에서 공유하는 타입 정의.

// 터미널 색상 테마 (xterm theme로 매핑)
export interface TerminalTheme {
  background: string; // 배경색
  foreground: string; // 글자색
  cursor: string; // 커서색
  // ANSI 8번(bright black) = "흐린 회색". zsh-autosuggestions 제안 텍스트가
  // 기본값(fg=8)으로 이 색을 사용하므로, 테마별로 전경색보다 한 단계 흐린
  // 회색을 지정해 입력한 글자와 시각적으로 구분되게 한다.
  brightBlack: string;
}

// 사용자 설정 — JSON 파일(userData/settings.json)에 저장된다.
// 색상 테마 모드 — 다크/라이트 중 하나만 선택한다.
export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  hotkey: string; // 전역 단축키 (Electron accelerator 문법, 예: "Command+`")
  fontSize: number; // 터미널 폰트 크기(px)
  themeMode: ThemeMode; // 색상 테마(다크/라이트)
}

// 기본 설정값 — 설정 파일이 없거나 손상됐을 때의 폴백.
export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'Command+`',
  fontSize: 13,
  themeMode: 'dark',
};

// 다크/라이트 테마의 실제 색상값 — xterm theme 및 창 배경에 적용된다.
// 라이트는 순백(#fff) 대신 눈부심을 줄인 따뜻한 오프화이트(크림톤)를 사용한다.
export const TERMINAL_THEMES: Record<ThemeMode, TerminalTheme> = {
  // 다크: 밝은 전경(#cdd6f4) 대비 한 단계 흐린 회색(#6c7086)으로 제안을 표시.
  dark: { background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc', brightBlack: '#6c7086' },
  // 라이트: 어두운 전경(#4c4f69)보다 "밝은" 회색(#9ca0b0)이라야 흐리게 보인다.
  light: { background: '#f4ecd8', foreground: '#4c4f69', cursor: '#1e66f5', brightBlack: '#9ca0b0' },
};

// 터미널에 고정으로 사용하는 웹폰트 패밀리.
// JetBrains Mono를 @font-face(terminal.css)로 번들해 사용하며, 설정으로 변경하지 않는다.
// (시스템에 폰트가 없을 때를 대비해 Menlo/monospace 폴백을 둔다.)
export const TERMINAL_FONT_FAMILY = "'JetBrains Mono', Menlo, Monaco, monospace";

// preload가 contextBridge로 렌더러(window.api)에 노출하는 API 계약.
export interface PeekTermAPI {
  // ── 터미널(PTY) ──
  ptyWrite: (data: string) => void; // 키 입력을 PTY로 전송
  ptyResize: (cols: number, rows: number) => void; // 터미널 크기 변경 통지
  onPtyData: (cb: (data: string) => void) => void; // PTY 출력 수신
  onPtyExit: (cb: (code: number) => void) => void; // PTY 종료 수신
  hideWindow: () => void; // 터미널 창 숨김 요청
  // ── 설정 ──
  getSettings: () => Promise<AppSettings>; // 현재 설정 조회
  saveSettings: (settings: AppSettings) => Promise<AppSettings>; // 설정 저장(병합된 결과 반환)
  onSettingsApply: (cb: (settings: AppSettings) => void) => void; // 설정 즉시 적용 수신
}

// 렌더러 전역(window.api) 타입 보강.
declare global {
  interface Window {
    api: PeekTermAPI;
  }
}
