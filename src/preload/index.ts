// preload — 렌더러에 안전한 API만 노출한다(contextIsolation 환경).
// 터미널 창과 설정 창이 동일한 preload를 공유하며, window.api 하나로 통합 노출한다.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { PeekTermAPI, AppSettings } from '@shared/types';

const api: PeekTermAPI = {
  // ── 터미널(PTY) ──
  ptyWrite: (data) => ipcRenderer.send(IPC.PTY_WRITE, data),
  ptyResize: (cols, rows) => ipcRenderer.send(IPC.PTY_RESIZE, cols, rows),
  onPtyData: (cb) => {
    // 중복 등록 방지 — 재마운트 시 리스너가 누적되지 않도록 먼저 제거.
    ipcRenderer.removeAllListeners(IPC.PTY_DATA);
    ipcRenderer.on(IPC.PTY_DATA, (_e, data: string) => cb(data));
  },
  onPtyExit: (cb) => {
    ipcRenderer.removeAllListeners(IPC.PTY_EXIT);
    ipcRenderer.on(IPC.PTY_EXIT, (_e, code: number) => cb(code));
  },
  hideWindow: () => ipcRenderer.send(IPC.WINDOW_HIDE),

  // ── 설정 ──
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<AppSettings>,
  saveSettings: (settings) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, settings) as Promise<AppSettings>,
  onSettingsApply: (cb) => {
    ipcRenderer.removeAllListeners(IPC.SETTINGS_APPLY);
    ipcRenderer.on(IPC.SETTINGS_APPLY, (_e, s: AppSettings) => cb(s));
  },
  closeSettings: () => ipcRenderer.send(IPC.SETTINGS_CLOSE),
};

contextBridge.exposeInMainWorld('api', api);
