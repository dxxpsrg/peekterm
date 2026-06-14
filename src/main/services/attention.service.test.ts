import { describe, it, expect } from 'vitest';
import { containsBell } from './attention.service';

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
