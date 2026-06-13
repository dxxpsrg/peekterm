// macOS Space(가상 데스크톱) 처리 서비스.
// Electron이 노출하지 않는 NSWindow의 collectionBehavior를 koffi(FFI)로 직접 설정해,
// "창이 활성화될 때 현재 Space로 끌어오고(점프 없음), 다른 Space로 이동해도 따라오지 않게(깜빡임 없음)"
// 만든다. 이는 macOS의 NSWindowCollectionBehaviorMoveToActiveSpace 동작이며 Electron API로는 불가능하다.
import type { BrowserWindow } from 'electron';
import * as koffi from 'koffi';

// NSWindowCollectionBehavior 비트값(AppKit).
// 주의: CAN_JOIN_ALL_SPACES와 MOVE_TO_ACTIVE_SPACE는 상호 배타이므로 동시에 켜면 안 된다.
const CAN_JOIN_ALL_SPACES = 1 << 0; // 모든 Space에 따라다님 → 이동 시 깜빡임의 원인. 반드시 끈다.
const MOVE_TO_ACTIVE_SPACE = 1 << 1; // 활성화 시 창을 현재 Space로 가져옴 → 점프 방지.
const FULL_SCREEN_AUXILIARY = 1 << 8; // 풀스크린 앱 Space에서도 보조 창으로 표시(기존 visibleOnFullScreen 동작 유지).

// objc 런타임 호출 래퍼 — 최초 호출 시 1회 바인딩 후 캐시한다.
interface ObjcRuntime {
  getWindow: (view: unknown) => unknown; // [view window] → NSWindow*
  getBehavior: (window: unknown) => number; // [window collectionBehavior]
  setBehavior: (window: unknown, value: number) => void; // [window setCollectionBehavior:]
}

let runtime: ObjcRuntime | null = null;

function bindObjcRuntime(): ObjcRuntime {
  if (runtime) return runtime;

  const objc = koffi.load('/usr/lib/libobjc.A.dylib');
  const selRegisterName = objc.func('sel_registerName', 'void *', ['str']);
  // 동일 심볼 objc_msgSend를 호출 형태별로 별도 바인딩한다(C 가변인자라 시그니처별 정의가 필요).
  const msgSendPtr = objc.func('objc_msgSend', 'void *', ['void *', 'void *']);
  const msgSendUint = objc.func('objc_msgSend', 'uint64', ['void *', 'void *']);
  const msgSendVoidUint = objc.func('objc_msgSend', 'void', ['void *', 'void *', 'uint64']);

  runtime = {
    getWindow: (view) => msgSendPtr(view, selRegisterName('window')),
    getBehavior: (window) => Number(msgSendUint(window, selRegisterName('collectionBehavior'))),
    setBehavior: (window, value) =>
      msgSendVoidUint(window, selRegisterName('setCollectionBehavior:'), value),
  };
  return runtime;
}

// 주어진 창을 "현재 Space로 가져오되 다른 Space로는 따라가지 않는" 동작으로 설정한다.
// 창 생성 직후 1회만 호출하면 창이 파괴될 때까지 영구 적용된다.
export function enableMoveToActiveSpace(win: BrowserWindow): void {
  if (process.platform !== 'darwin') return; // macOS 전용 동작.

  try {
    const objc = bindObjcRuntime();
    // getNativeWindowHandle()은 NSView* 주소를 담은 Buffer다. 그 포인터를 디코드한다.
    const view = koffi.decode(win.getNativeWindowHandle(), 'void *');
    const window = objc.getWindow(view);

    // 현재 동작 비트를 읽어 상호 배타 비트를 정리한 뒤 원하는 동작을 더한다.
    const current = objc.getBehavior(window);
    const next = (current & ~CAN_JOIN_ALL_SPACES) | MOVE_TO_ACTIVE_SPACE | FULL_SCREEN_AUXILIARY;
    objc.setBehavior(window, next);
  } catch (err) {
    // 실패해도 앱은 계속 동작한다(점프/깜빡임이 남는 기존 동작으로 degrade). 절대 크래시하지 않는다.
    console.warn('[macos-space] moveToActiveSpace 설정 실패 — 기존 Space 동작으로 진행:', err);
  }
}
