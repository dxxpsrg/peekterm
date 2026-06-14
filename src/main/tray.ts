// 메뉴바 트레이 아이콘.
// 좌클릭 → 터미널 호출(숨김은 blur가 담당), 우클릭 → 설정/종료 메뉴.
import { Tray, Menu, nativeImage, app, NativeImage } from 'electron';
import path from 'path';
import { showTerminalWindow } from './windows/terminal-window';
import { openSettingsWindow } from './windows/settings-window';
import { registerTrayForAttention } from './services/attention.service';

let tray: Tray | null = null;

// 트레이용 템플릿 아이콘 로드. 파일이 없으면 빈 이미지로 폴백(앱이 죽지 않도록).
function loadTrayIcon(): NativeImage {
  try {
    // 패키징 시엔 resources/assets, dev에선 프로젝트 루트/assets.
    const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
    let img = nativeImage.createFromPath(path.join(base, 'assets', 'tray-icon.png'));
    if (!img.isEmpty()) {
      // 메뉴바 표준 크기(18px)로 맞추고, 템플릿 이미지로 지정해
      // macOS가 다크/라이트 메뉴바에 맞춰 자동 채색하도록 한다.
      img = img.resize({ width: 18, height: 18 });
      img.setTemplateImage(true);
      return img;
    }
  } catch {
    // 무시하고 폴백.
  }
  return nativeImage.createEmpty();
}

export function createTray(): Tray {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('peekterm');

  // 완료 알림(점) 서비스에 트레이 인스턴스를 등록한다.
  registerTrayForAttention(tray);

  // 좌클릭 → 터미널 표시.
  tray.on('click', () => showTerminalWindow());

  // 우클릭 → 컨텍스트 메뉴.
  const menu = Menu.buildFromTemplate([
    { label: '설정…', click: () => openSettingsWindow() },
    { type: 'separator' },
    { label: 'peekterm 종료', click: () => app.quit() },
  ]);
  tray.on('right-click', () => tray?.popUpContextMenu(menu));

  return tray;
}
