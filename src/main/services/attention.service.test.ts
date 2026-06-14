import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  containsBell,
  containsAttentionSignal,
  hasSpinnerTitle,
  assembleForDetection,
  updateFromOutput,
  acknowledgeIfDone,
  setVisibilityGetter,
  getTrayState,
  resetTrayState,
} from './attention.service';

describe('containsBell', () => {
  it('순수 벨(\\x07)을 감지한다', () => {
    expect(containsBell('\x07')).toBe(true);
  });

  it('일반 텍스트에는 반응하지 않는다', () => {
    expect(containsBell('hello world')).toBe(false);
  });

  it('OSC 제목 변경 시퀀스의 종결 BEL은 오탐하지 않는다', () => {
    // ESC ] 0 ; title BEL — 창 제목 변경. 점이 켜지면 안 된다.
    expect(containsBell('\x1b]0;my title\x07')).toBe(false);
  });

  it('OSC 시퀀스 뒤에 오는 진짜 벨은 감지한다', () => {
    expect(containsBell('\x1b]0;title\x07\x07')).toBe(true);
  });

  it('ST(ESC \\)로 종결되는 OSC 시퀀스도 오탐하지 않는다', () => {
    // 일부 도구는 BEL 대신 ST(ESC \)로 OSC를 종결한다.
    expect(containsBell('\x1b]0;title\x1b\\')).toBe(false);
  });

  it('출력 중간에 섞인 순수 벨도 감지한다', () => {
    expect(containsBell('done\x07\n')).toBe(true);
  });
});

describe('containsAttentionSignal', () => {
  it('순수 벨(\\x07)을 완료 신호로 인정한다', () => {
    expect(containsAttentionSignal('\x07')).toBe(true);
  });

  it('OSC 9 데스크톱 알림을 감지한다', () => {
    // ESC ] 9 ; message BEL — iTerm2 등에서 쓰는 단순 알림.
    expect(containsAttentionSignal('\x1b]9;Claude is done\x07')).toBe(true);
  });

  it('OSC 777;notify 알림을 감지한다', () => {
    // ESC ] 777 ; notify ; title ; body BEL — urxvt 계열 알림.
    expect(containsAttentionSignal('\x1b]777;notify;Claude;Done\x07')).toBe(true);
  });

  it('OSC 99(kitty) 알림을 감지한다', () => {
    expect(containsAttentionSignal('\x1b]99;i=1:d=0;Done\x1b\\')).toBe(true);
  });

  it('OSC 1337(iTerm2) 알림을 감지한다', () => {
    expect(containsAttentionSignal('\x1b]1337;Notify=Done\x07')).toBe(true);
  });

  it('OSC 9;4 진행률(progress)은 완료 신호로 오탐하지 않는다', () => {
    // ESC ] 9 ; 4 ; 50 BEL — 진행률 갱신이라 매번 점이 켜지면 안 된다.
    expect(containsAttentionSignal('\x1b]9;4;50\x07')).toBe(false);
  });

  it('OSC 제목 변경(OSC 0)은 완료 신호로 오탐하지 않는다', () => {
    expect(containsAttentionSignal('\x1b]0;my title\x07')).toBe(false);
  });

  it('일반 텍스트에는 반응하지 않는다', () => {
    expect(containsAttentionSignal('hello world')).toBe(false);
  });
});

describe('hasSpinnerTitle', () => {
  it('스피너(브라유) 제목을 감지한다', () => {
    expect(hasSpinnerTitle('\x1b]0;⠋ Claude Code\x07')).toBe(true);
  });

  it('스피너 없는 완료 제목(✳)은 감지하지 않는다', () => {
    expect(hasSpinnerTitle('\x1b]0;✳ Claude Code\x07')).toBe(false);
  });

  it('일반 셸 제목도 스피너로 보지 않는다', () => {
    expect(hasSpinnerTitle('\x1b]0;dxxpsr@host:~\x07')).toBe(false);
  });

  it('제목 변경이 없는 출력은 false', () => {
    expect(hasSpinnerTitle('just some text\n')).toBe(false);
  });

  it('ST(ESC \\)로 종결되는 스피너 제목도 감지한다', () => {
    expect(hasSpinnerTitle('\x1b]2;⠼ build\x1b\\')).toBe(true);
  });
});

describe('updateFromOutput (스피너 디바운스 상태 머신)', () => {
  // 타이머와 전역 상태를 케이스마다 초기화한다.
  beforeEach(() => {
    vi.useFakeTimers();
    resetTrayState();
  });
  afterEach(() => vi.useRealTimers());

  // Claude Code 제목 예시: 작업 중 '⠋ Claude Code', 완료/대기 '✳ Claude Code'.
  const WORKING = '\x1b]0;⠋ Claude Code\x07';
  const IDLE_TITLE = '\x1b]0;✳ Claude Code\x07';

  it('스피너가 보이면 즉시 working이 된다(가시성 무관)', () => {
    setVisibilityGetter(() => true); // 창을 보고 있어도
    updateFromOutput(WORKING);
    expect(getTrayState()).toBe('working'); // 깜빡임은 항상.
  });

  it('창을 보고 있지 않으면 디바운스 후 done(코랄)이 된다', () => {
    setVisibilityGetter(() => false);
    updateFromOutput(WORKING);
    vi.advanceTimersByTime(1500);
    expect(getTrayState()).toBe('done');
  });

  it('창을 보고 있으면 완료 시 코랄 대신 idle로 돌아간다', () => {
    setVisibilityGetter(() => true);
    updateFromOutput(WORKING);
    vi.advanceTimersByTime(1500);
    expect(getTrayState()).toBe('idle');
  });

  it('작업 중 비스피너 제목이 잠깐 껴도 깜빡임(working)을 유지한다', () => {
    updateFromOutput(WORKING);
    vi.advanceTimersByTime(1000); // 디바운스(1500) 전.
    updateFromOutput(IDLE_TITLE); // 스피너 없음 → 상태 영향 없음.
    expect(getTrayState()).toBe('working');
    updateFromOutput(WORKING); // 다시 스피너 → 완료 타이머 리셋.
    vi.advanceTimersByTime(1000);
    expect(getTrayState()).toBe('working'); // 아직 완료 아님.
  });

  it('acknowledgeIfDone는 done일 때만 idle로 되돌린다', () => {
    updateFromOutput(WORKING);
    vi.advanceTimersByTime(1500); // hidden 기본값 → done.
    expect(getTrayState()).toBe('done');
    acknowledgeIfDone();
    expect(getTrayState()).toBe('idle');
  });

  it('작업 중 acknowledgeIfDone는 깜빡임을 끄지 않는다(터미널 자동 응답 보호)', () => {
    updateFromOutput(WORKING);
    acknowledgeIfDone(); // working 상태에서는 무시되어야 한다.
    expect(getTrayState()).toBe('working');
    vi.advanceTimersByTime(1500);
    expect(getTrayState()).toBe('done'); // 그대로 완료까지 진행.
  });
});

describe('assembleForDetection (청크 경계 보정)', () => {
  // carry 버퍼를 케이스마다 초기화한다.
  beforeEach(() => resetTrayState());

  it('두 청크에 걸친 스피너 제목을 이어붙여 감지한다', () => {
    // 첫 청크는 OSC 제목이 미완성이라 캐리로 넘겨 빈 문자열을 돌려준다.
    const first = assembleForDetection('\x1b]0;⠋ Cla');
    expect(hasSpinnerTitle(first)).toBe(false);
    // 다음 청크에서 이어붙여 완성되면 스피너가 감지된다.
    const second = assembleForDetection('ude Code\x07');
    expect(hasSpinnerTitle(second)).toBe(true);
  });

  it('완결된 시퀀스는 그대로 통과시킨다(캐리 없음)', () => {
    const out = assembleForDetection('hello\x1b]0;✳ Claude Code\x07world');
    expect(out).toBe('hello\x1b]0;✳ Claude Code\x07world');
  });

  it('끝의 외톨이 ESC는 다음 청크로 이월한다', () => {
    expect(assembleForDetection('abc\x1b')).toBe('abc'); // ESC 한 글자는 캐리.
    expect(assembleForDetection('[31mx')).toBe('\x1b[31mx'); // 이어붙여 복원.
  });

  it('일반 텍스트는 변형 없이 그대로 돌려준다', () => {
    expect(assembleForDetection('just plain output\n')).toBe('just plain output\n');
  });
});
