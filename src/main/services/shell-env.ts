// 셸 환경변수 위생 처리.
// PTY로 셸을 띄울 때 부모(Electron main) 환경을 대부분 물려주되, Electron이 주입하는 내부 변수와
// NODE_OPTIONS는 제거한다 — 셸이나 그 하위 프로세스로 새어 들어가면 오작동할 수 있기 때문이다.
// 예: ELECTRON_RUN_AS_NODE가 남아 있으면 셸에서 실행한 `node`/Electron 기반 도구가 엉뚱하게 동작한다.
//
// allowlist(필요한 키만 추림)는 PATH/HOME/SHELL 등 누락 위험이 커서 쓰지 않고,
// denylist(문제되는 키만 제거)로 간다. node-pty 같은 런타임 의존이 없어 vitest에서 그대로 테스트된다.

/** 셸에 넘길 환경변수를 만든다(Electron 내부 변수·NODE_OPTIONS 제거). */
export function buildShellEnv(parent: NodeJS.ProcessEnv): { [key: string]: string } {
  const env: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue; // 값 없는 키는 건너뛴다.
    if (key.startsWith('ELECTRON_')) continue; // Electron 주입 내부 변수 제거.
    if (key === 'NODE_OPTIONS') continue; // 셸의 node에 의도치 않게 적용되는 것을 막는다.
    env[key] = value;
  }
  return env;
}
