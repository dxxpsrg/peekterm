// 설정 창 관리 — 트레이 컨텍스트 메뉴에서 연다.
// 터미널 창과 달리 일반 창이며 blur로 숨기지 않는다.
import { BrowserWindow } from 'electron';
import path from 'path';

let settingsWin: BrowserWindow | null = null;

export function openSettingsWindow(): void {
  // 이미 열려 있으면 새로 만들지 않고 앞으로 가져온다.
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 460,
    height: 480,
    resizable: false,
    title: 'peekterm 설정',
    titleBarStyle: 'hiddenInset', // 타이틀바를 숨겨 콘텐츠와 일체화(맥 신호등 버튼은 유지)
    backgroundColor: '#15151d', // 로딩 중 흰 화면 깜빡임 방지
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 멀티 엔트리 중 settings.html을 로드한다.
  if (process.env['ELECTRON_RENDERER_URL']) {
    settingsWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`);
  } else {
    settingsWin.loadFile(path.join(__dirname, '../renderer/settings.html'));
  }

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

// 설정 창을 닫는다 — 렌더러의 "닫기"/"저장" 버튼에서 호출된다.
// 이미 닫혔거나 없는 경우는 무시(방어적 처리). close 시 위의 'closed' 핸들러가
// 참조를 정리하므로, 다음에 열 때 openSettingsWindow가 새로 생성한다.
export function closeSettingsWindow(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.close();
  }
}
