import { describe, it, expect } from 'vitest';
import { buildShellEnv } from './shell-env';

describe('buildShellEnv', () => {
  it('일반 변수(PATH/HOME/SHELL 등)는 그대로 유지한다', () => {
    const env = buildShellEnv({ PATH: '/usr/bin', HOME: '/Users/x', SHELL: '/bin/zsh' });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/Users/x');
    expect(env.SHELL).toBe('/bin/zsh');
  });

  it('ELECTRON_* 내부 변수를 모두 제거한다', () => {
    const env = buildShellEnv({
      PATH: '/usr/bin',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ASAR: '1',
    });
    expect(env.PATH).toBe('/usr/bin'); // 일반 변수는 유지.
    expect('ELECTRON_RUN_AS_NODE' in env).toBe(false);
    expect('ELECTRON_NO_ASAR' in env).toBe(false);
  });

  it('NODE_OPTIONS를 제거한다', () => {
    const env = buildShellEnv({ PATH: '/usr/bin', NODE_OPTIONS: '--enable-source-maps' });
    expect('NODE_OPTIONS' in env).toBe(false);
  });

  it('값이 undefined인 키는 건너뛴다', () => {
    const env = buildShellEnv({ FOO: undefined, BAR: 'ok' });
    expect('FOO' in env).toBe(false);
    expect(env.BAR).toBe('ok');
  });
});
