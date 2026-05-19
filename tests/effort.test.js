import { describe, it, expect } from 'vitest';
import {
  codexEffortValues,
  claudeEffortValues,
  buildCliInvocation,
  EFFORT_LEVELS,
} from '../src/effort.js';

describe('effort translation', () => {
  it('UI levels are exactly low/medium/high/xhigh/max', () => {
    expect(EFFORT_LEVELS).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
  });

  describe('codex effort values (含 h)', () => {
    it.each([
      ['low', 'low'],
      ['medium', 'medium'],
      ['high', 'high'],
      ['xhigh', 'xhigh'],
      ['max', 'xhigh'], // codex 無 max，封頂為 xhigh
    ])('codex %s → flag value %s', (uiLevel, expectedValue) => {
      expect(codexEffortValues[uiLevel]).toBe(expectedValue);
    });

    it('codex max literally equals xhigh (封頂)', () => {
      expect(codexEffortValues.max).toBe('xhigh');
    });
  });

  describe('claude effort values', () => {
    it.each([
      ['low', 'low'],
      ['medium', 'medium'],
      ['high', 'high'],
      ['xhigh', 'xhigh'], // claude --help 親查 — 含 h
      ['max', 'max'],
    ])('claude %s → flag value %s', (uiLevel, expectedValue) => {
      expect(claudeEffortValues[uiLevel]).toBe(expectedValue);
    });

    it('claude xhigh literally equals xhigh (含 h — 親查 claude --help 後修正)', () => {
      expect(claudeEffortValues.xhigh).toBe('xhigh');
    });

    it('claude max literally equals max', () => {
      expect(claudeEffortValues.max).toBe('max');
    });
  });

  describe('buildCliInvocation', () => {
    it('claude uses --print + --effort <value>', () => {
      expect(buildCliInvocation('claude', 'medium')).toEqual([
        '--print',
        '--effort',
        'medium',
      ]);
    });

    it('claude xhigh maps to literal --effort xhigh', () => {
      expect(buildCliInvocation('claude', 'xhigh')).toEqual([
        '--print',
        '--effort',
        'xhigh',
      ]);
    });

    it('claude max maps to --effort max', () => {
      expect(buildCliInvocation('claude', 'max')).toEqual([
        '--print',
        '--effort',
        'max',
      ]);
    });

    it('codex uses exec + -c model_reasoning_effort=<value>', () => {
      const args = buildCliInvocation('codex', 'medium');
      expect(args[0]).toBe('exec');
      expect(args).toContain('-c');
      expect(args).toContain('model_reasoning_effort=medium');
    });

    it('codex includes --skip-git-repo-check to support running anywhere', () => {
      expect(buildCliInvocation('codex', 'low')).toContain('--skip-git-repo-check');
    });

    it('codex xhigh maps to model_reasoning_effort=xhigh (含 h)', () => {
      expect(buildCliInvocation('codex', 'xhigh')).toContain('model_reasoning_effort=xhigh');
    });

    it('codex max封頂為 xhigh', () => {
      expect(buildCliInvocation('codex', 'max')).toContain('model_reasoning_effort=xhigh');
    });

    it('throws on unknown cli', () => {
      expect(() => buildCliInvocation('gemini', 'medium')).toThrow();
    });

    it('throws on unknown level', () => {
      expect(() => buildCliInvocation('codex', 'extra')).toThrow();
    });
  });
});
