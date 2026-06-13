// IPC 핸들러 등록 — 렌더러와 main 사이의 모든 통신을 한 곳에서 연결한다.
import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { AppSettings } from '@shared/types';
import * as pty from '../services/pty.service';
import { loadSettings, saveSettings } from '../services/settings.service';
import { registerHotkey } from '../services/hotkey.service';
import {
  getTerminalWindow,
  hideTerminalWindow,
  showTerminalWindow,
} from '../windows/terminal-window';
import { closeSettingsWindow } from '../windows/settings-window';

export function registerIpcHandlers(): void {
  // ── 터미널 입력(renderer → main) ──
  ipcMain.on(IPC.PTY_WRITE, (_e, data: string) => pty.write(data));
  ipcMain.on(IPC.PTY_RESIZE, (_e, cols: number, rows: number) => pty.resize(cols, rows));

  // ── 터미널 출력(main → renderer) ──
  // PTY는 창 가시성과 무관하게 살아 있고, 출력은 그때그때 터미널 창으로 전달한다.
  pty.onData((data) => {
    getTerminalWindow()?.webContents.send(IPC.PTY_DATA, data);
  });
  pty.onExit((code) => {
    getTerminalWindow()?.webContents.send(IPC.PTY_EXIT, code);
  });

  // ── 창 숨김 요청 ──
  ipcMain.on(IPC.WINDOW_HIDE, () => hideTerminalWindow());

  // ── 설정 창 닫기 요청 ──
  ipcMain.on(IPC.SETTINGS_CLOSE, () => closeSettingsWindow());

  // ── 설정 조회 ──
  ipcMain.handle(IPC.SETTINGS_GET, () => loadSettings());

  // ── 설정 저장 → 디스크 기록 + 단축키 재등록 + 터미널에 즉시 반영 ──
  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, settings: AppSettings) => {
    const saved = saveSettings(settings);
    registerHotkey(saved.hotkey, showTerminalWindow); // 새 단축키로 교체.
    getTerminalWindow()?.webContents.send(IPC.SETTINGS_APPLY, saved); // 테마/폰트 즉시 적용.
    return saved;
  });
}
