import { describe, it, expect } from 'vitest';
import { buildTurnPlan } from '../src/turn-plan.js';

describe('Turn Order Is Determined by First Speaker Selection — Last Two Turns Are Always Closing Turns', () => {
  it('pro first + perSideCount 3 produces 8-turn plan', () => {
    const plan = buildTurnPlan({
      firstSpeakerStance: 'pro',
      perSideCount: 3,
      proSide: 'codex',
      conSide: 'claude',
    });
    expect(plan).toHaveLength(8);
    const stances = plan.map((t) => t.stance);
    expect(stances).toEqual(['pro', 'con', 'pro', 'con', 'pro', 'con', 'pro', 'con']);
    const kinds = plan.map((t) => t.kind);
    expect(kinds).toEqual([
      'debate',
      'debate',
      'debate',
      'debate',
      'debate',
      'debate',
      'closing',
      'closing',
    ]);
    const clis = plan.map((t) => t.cli);
    expect(clis).toEqual(['codex', 'claude', 'codex', 'claude', 'codex', 'claude', 'codex', 'claude']);
    expect(plan.map((t) => t.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('con first + perSideCount 2 produces 6-turn plan', () => {
    const plan = buildTurnPlan({
      firstSpeakerStance: 'con',
      perSideCount: 2,
      proSide: 'codex',
      conSide: 'claude',
    });
    expect(plan).toHaveLength(6);
    const stances = plan.map((t) => t.stance);
    expect(stances).toEqual(['con', 'pro', 'con', 'pro', 'con', 'pro']);
    const kinds = plan.map((t) => t.kind);
    expect(kinds).toEqual(['debate', 'debate', 'debate', 'debate', 'closing', 'closing']);
    const clis = plan.map((t) => t.cli);
    expect(clis).toEqual(['claude', 'codex', 'claude', 'codex', 'claude', 'codex']);
  });

  it('pro first + perSideCount 5 produces 12-turn plan (10 debate + 2 closing)', () => {
    const plan = buildTurnPlan({
      firstSpeakerStance: 'pro',
      perSideCount: 5,
      proSide: 'claude',
      conSide: 'codex',
    });
    expect(plan).toHaveLength(12);
    const kinds = plan.map((t) => t.kind);
    expect(kinds.slice(0, 10).every((k) => k === 'debate')).toBe(true);
    expect(kinds.slice(10)).toEqual(['closing', 'closing']);
  });

  it('throws on invalid perSideCount (outside 2~999)', () => {
    expect(() =>
      buildTurnPlan({ firstSpeakerStance: 'pro', perSideCount: 1, proSide: 'codex', conSide: 'claude' })
    ).toThrow();
    expect(() =>
      buildTurnPlan({ firstSpeakerStance: 'pro', perSideCount: 1000, proSide: 'codex', conSide: 'claude' })
    ).toThrow();
  });

  it('perSideCount 999 is valid and produces 2000-turn plan', () => {
    const plan = buildTurnPlan({
      firstSpeakerStance: 'pro',
      perSideCount: 999,
      proSide: 'codex',
      conSide: 'claude',
    });
    expect(plan).toHaveLength(999 * 2 + 2);
    expect(plan[0].kind).toBe('debate');
    expect(plan[plan.length - 1].kind).toBe('closing');
  });
});
