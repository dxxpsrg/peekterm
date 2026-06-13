// main ↔ renderer 간 IPC 채널 이름 상수.
// 문자열 오타로 인한 연결 누락을 막기 위해 한 곳에서 관리한다.
export const IPC = {
  PTY_WRITE: 'pty:write', // (renderer→main) 키 입력
  PTY_RESIZE: 'pty:resize', // (renderer→main) 크기 변경
  PTY_DATA: 'pty:data', // (main→renderer) PTY 출력
  PTY_EXIT: 'pty:exit', // (main→renderer) PTY 종료
  WINDOW_HIDE: 'window:hide', // (renderer→main) 창 숨김 요청
  SETTINGS_GET: 'settings:get', // (renderer→main, invoke) 설정 조회
  SETTINGS_SAVE: 'settings:save', // (renderer→main, invoke) 설정 저장
  SETTINGS_APPLY: 'settings:apply', // (main→renderer) 설정 즉시 적용
  SETTINGS_CLOSE: 'settings:close', // (renderer→main) 설정 창 닫기 요청
} as const;
