import { describe, it, expect } from 'vitest';
import {
  validateTopic,
  validatePerSideCount,
  validateSetupForm,
  TOPIC_MIN,
  TOPIC_MAX,
  PER_SIDE_MIN,
  PER_SIDE_MAX,
} from '../src/validators.js';

describe('validateTopic (Topic Validation Enforces Length Bounds)', () => {
  it.each([
    [3, false], // 邊界：too short
    [4, true], // 邊界：min OK
    [50, true], // mid
    [100, true], // 邊界：max OK
    [101, false], // 邊界：too long
  ])('trimmed length %d → valid=%s', (length, expected) => {
    const result = validateTopic('a'.repeat(length));
    expect(result.valid).toBe(expected);
  });

  it('trims whitespace before checking', () => {
    expect(validateTopic('   abcd   ').valid).toBe(true); // trimmed = 4
    expect(validateTopic('   abc   ').valid).toBe(false); // trimmed = 3
  });

  it('empty / whitespace-only invalid', () => {
    expect(validateTopic('').valid).toBe(false);
    expect(validateTopic('   ').valid).toBe(false);
  });

  it('exposes bounds constants', () => {
    expect(TOPIC_MIN).toBe(4);
    expect(TOPIC_MAX).toBe(100);
  });

  it('returns helpful message on failure (no Chinese garbage)', () => {
    const r = validateTopic('abc');
    expect(r.valid).toBe(false);
    expect(typeof r.message).toBe('string');
    expect(r.message.length).toBeGreaterThan(0);
  });
});

describe('validatePerSideCount (Per-Side Turn Count Constrained to 2 Through 5 Inclusive)', () => {
  it.each([
    [1, false],
    [2, true],
    [3, true],
    [4, true],
    [5, true],
    [6, false],
    [0, false],
    [-1, false],
  ])('value %d → valid=%s', (value, expected) => {
    expect(validatePerSideCount(value).valid).toBe(expected);
  });

  it('rejects non-integers', () => {
    expect(validatePerSideCount(3.5).valid).toBe(false);
    expect(validatePerSideCount(NaN).valid).toBe(false);
    expect(validatePerSideCount('3').valid).toBe(false);
  });

  it('exposes bounds constants', () => {
    expect(PER_SIDE_MIN).toBe(2);
    expect(PER_SIDE_MAX).toBe(5);
  });
});

describe('validateSetupForm — 全欄聚合', () => {
  const goodInput = {
    topic: '死刑是否應廢除',
    proSide: 'codex',
    perSideCount: 3,
    firstSpeakerStance: 'pro',
    effortLevel: 'medium',
  };

  it('valid input passes', () => {
    expect(validateSetupForm(goodInput).valid).toBe(true);
  });

  it('invalid topic fails', () => {
    expect(validateSetupForm({ ...goodInput, topic: 'ab' }).valid).toBe(false);
  });

  it('invalid perSideCount fails', () => {
    expect(validateSetupForm({ ...goodInput, perSideCount: 7 }).valid).toBe(false);
  });

  it('invalid proSide fails', () => {
    expect(validateSetupForm({ ...goodInput, proSide: 'gemini' }).valid).toBe(false);
  });

  it('invalid firstSpeakerStance fails', () => {
    expect(validateSetupForm({ ...goodInput, firstSpeakerStance: 'middle' }).valid).toBe(false);
  });

  it('invalid effortLevel fails', () => {
    expect(validateSetupForm({ ...goodInput, effortLevel: 'super' }).valid).toBe(false);
  });
});
