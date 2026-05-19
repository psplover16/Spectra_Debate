import { describe, it, expect } from 'vitest';
import {
  STANCES,
  CLI_NAMES,
  EFFORT_LEVELS,
  TURN_STATUSES,
  TURN_KINDS,
  createTurn,
  createInitialDebateState,
} from '../src/state.js';

describe('constants', () => {
  it('STANCES are pro/con', () => {
    expect(STANCES).toEqual(['pro', 'con']);
  });
  it('CLI_NAMES are codex/claude', () => {
    expect(CLI_NAMES).toEqual(['codex', 'claude']);
  });
  it('EFFORT_LEVELS are 5-tier UI ordering', () => {
    expect(EFFORT_LEVELS).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
  });
  it('TURN_STATUSES exhaustive', () => {
    expect(TURN_STATUSES).toEqual(['pending', 'streaming', 'done', 'failed']);
  });
  it('TURN_KINDS are debate/closing', () => {
    expect(TURN_KINDS).toEqual(['debate', 'closing']);
  });
});

describe('createTurn factory — 雙欄位強制', () => {
  it('returns turn with independent cli and stance', () => {
    const t = createTurn({ index: 1, cli: 'codex', stance: 'pro', kind: 'debate' });
    expect(t.cli).toBe('codex');
    expect(t.stance).toBe('pro');
    // 兩欄位獨立、可分別存取
    expect('cli' in t).toBe(true);
    expect('stance' in t).toBe(true);
  });

  it('default status is pending and content empty', () => {
    const t = createTurn({ index: 1, cli: 'codex', stance: 'pro', kind: 'debate' });
    expect(t.status).toBe('pending');
    expect(t.content).toBe('');
  });

  it('startedAt is ISO 8601 string', () => {
    const t = createTurn({ index: 1, cli: 'codex', stance: 'pro', kind: 'debate' });
    expect(t.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('different cli and stance combinations are all valid', () => {
    const a = createTurn({ index: 2, cli: 'claude', stance: 'con', kind: 'debate' });
    expect(a.cli).toBe('claude');
    expect(a.stance).toBe('con');
    const b = createTurn({ index: 3, cli: 'claude', stance: 'pro', kind: 'closing' });
    expect(b.cli).toBe('claude');
    expect(b.stance).toBe('pro');
  });

  it('throws on invalid stance', () => {
    expect(() => createTurn({ index: 1, cli: 'codex', stance: 'other', kind: 'debate' })).toThrow();
  });

  it('throws on invalid cli', () => {
    expect(() => createTurn({ index: 1, cli: 'gemini', stance: 'pro', kind: 'debate' })).toThrow();
  });
});

describe('createInitialDebateState', () => {
  it('proSide and conSide are different (conSide derived)', () => {
    const s = createInitialDebateState({
      topic: 'topic',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(s.proSide).toBe('codex');
    expect(s.conSide).toBe('claude');
    expect(s.proSide).not.toBe(s.conSide);
  });

  it('reversed proSide produces conSide = codex', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'claude',
      perSideCount: 2,
      firstSpeakerStance: 'con',
      effortLevel: 'high',
    });
    expect(s.proSide).toBe('claude');
    expect(s.conSide).toBe('codex');
  });

  it('turns array starts empty', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(s.turns).toEqual([]);
  });

  it('endedAt absent and exported false initially', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(s.endedAt).toBeUndefined();
    expect(s.exported).toBe(false);
  });

  it('startedAt is ISO 8601', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(s.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('proPersona and conPersona stored when provided', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
      proPersona: 'Junior 前端工程師',
      conPersona: '高中生',
    });
    expect(s.proPersona).toBe('Junior 前端工程師');
    expect(s.conPersona).toBe('高中生');
  });

  it('proPersona and conPersona default to empty string when omitted', () => {
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(s.proPersona).toBe('');
    expect(s.conPersona).toBe('');
  });

  it('perSideCount 999 is valid', () => {
    expect(() =>
      createInitialDebateState({
        topic: 't',
        proSide: 'codex',
        perSideCount: 999,
        firstSpeakerStance: 'pro',
        effortLevel: 'medium',
      })
    ).not.toThrow();
  });

  it('perSideCount 1000 throws', () => {
    expect(() =>
      createInitialDebateState({
        topic: 't',
        proSide: 'codex',
        perSideCount: 1000,
        firstSpeakerStance: 'pro',
        effortLevel: 'medium',
      })
    ).toThrow();
  });
});
