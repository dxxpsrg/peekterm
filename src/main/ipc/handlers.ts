// IPC 핸들러 등록 — 렌더러와 main 사이의 모든 통신을 한 곳에서 연결한다.
import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { AppSettings } from '@shared/types';
import * as pty from '../services/pty.service';
import { loadSettings, saveSettings } from '../services/settings.service';
import { registerHotkey } from '../services/hotkey.service';
import {
  assembleForDetection,
  containsAttentionSignal,
  hasSpinnerTitle,
  markDone,
  setVisibilityGetter,
  updateFromOutput,
} from '../services/attention.service';
import {
  getTerminalWindow,
  hideTerminalWindow,
  showTerminalWindow,
} from '../windows/terminal-window';
import { closeSettingsWindow } from '../windows/settings-window';

export function registerIpcHandlers(): void {
  // 완료 알림이 '창을 보고 있지 않을 때만' 뜨도록, 가시성 판단 함수를 주입한다.
  setVisibilityGetter(() => getTerminalWindow()?.isVisible() ?? false);

  // ── 터미널 입력(renderer → main) ──
  // 트레이 상태는 여기서 건드리지 않는다. 완료 코랄은 '창이 숨겨졌을 때'만 뜨는데,
  // 창이 숨겨진 동안 이 채널로 들어오는 데이터는 전부 터미널 자동 응답(커서 위치·DA 등)이라
  // 사용자 입력이 아니다. 완료 해제는 창을 열 때(showTerminalWindow)만 한다.
  ipcMain.on(IPC.PTY_WRITE, (_e, data: string) => {
    // 창을 숨겨도 터미널이 '포커스를 잃었다'고 보고하지 않도록 focus-out(CSI O, \x1b[O)을 제거한다.
    // Claude Code 등은 포커스를 잃으면 작업 중 제목 스피너 애니메이션을 멈추는데(출력 텍스트는 계속 흐름),
    // 그러면 창을 숨긴 동안 '작업 중 깜빡임'을 감지할 수 없게 된다. focus-out은 \x1b[O 한 시퀀스뿐이라
    // 안전하게 제거할 수 있고, 이로써 Claude는 항상 포커스된 것으로 보고 스피너를 계속 갱신한다.
    pty.write(data.replace(/\x1b\[O/g, ''));
  });
  ipcMain.on(IPC.PTY_RESIZE, (_e, cols: number, rows: number) => pty.resize(cols, rows));

  // ── 터미널 출력(main → renderer) ──
  // PTY는 창 가시성과 무관하게 살아 있고, 출력은 그때그때 터미널 창으로 전달한다.
  pty.onData((data) => {
    getTerminalWindow()?.webContents.send(IPC.PTY_DATA, data); // 렌더러엔 원본 그대로(여기서 버퍼링 금지).

    // 감지 경로는 청크 경계로 잘린 OSC 시퀀스를 이어붙여 사용한다(두 청크에 걸친 신호 누락 방지).
    const assembled = assembleForDetection(data);
    // 주 신호: 제목 스피너로 에이전트(Claude Code 등)의 작업 중/완료를 추적한다.
    // 스피너가 보이면 깜빡임, 일정 시간 안 보이면 코랄 고정.
    updateFromOutput(assembled);
    // 보조 신호: 스피너를 쓰지 않고 완료 시 벨/OSC만 보내는 도구를 위해 그 신호도 완료로 인정한다.
    // (스피너가 함께 온 청크에서는 작업 중이므로 완료로 보지 않는다.)
    if (!hasSpinnerTitle(assembled) && containsAttentionSignal(assembled)) markDone();
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
