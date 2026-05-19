// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CURRENT_KEY,
  LAST_FORM_VALUES_KEY,
  savePersistedState,
  saveLastFormValues,
  loadPersistedState,
  loadLastFormValues,
  determineInitialView,
} from '../src/persistence.js';
import { createInitialDebateState, createTurn } from '../src/state.js';

beforeEach(() => {
  localStorage.clear();
});

describe('localStorage keys are namespaced', () => {
  it('current key', () => {
    expect(CURRENT_KEY).toBe('spectra-debate:current');
  });
  it('lastFormValues key', () => {
    expect(LAST_FORM_VALUES_KEY).toBe('spectra-debate:lastFormValues');
  });
});

describe('saveLastFormValues — independent from current', () => {
  it('writes only the 5 form fields, never includes turns or endedAt', () => {
    saveLastFormValues({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
      extraField: 'should not appear',
    });
    const raw = localStorage.getItem(LAST_FORM_VALUES_KEY);
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(parsed.extraField).toBeUndefined();
    expect(parsed.turns).toBeUndefined();
  });

  it('loadLastFormValues returns null when no key', () => {
    expect(loadLastFormValues()).toBeNull();
  });

  it('round-trips identical payload', () => {
    const v = {
      topic: '辯題',
      proSide: 'claude',
      perSideCount: 4,
      firstSpeakerStance: 'con',
      effortLevel: 'high',
    };
    saveLastFormValues(v);
    expect(loadLastFormValues()).toEqual(v);
  });
});

describe('savePersistedState / loadPersistedState — DebateState round-trip', () => {
  it('round-trips a DebateState with turns', () => {
    const state = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    state.turns.push({
      ...createTurn({ index: 1, cli: 'codex', stance: 'pro', kind: 'debate' }),
      status: 'done',
      content: 'first statement',
      endedAt: new Date().toISOString(),
    });
    savePersistedState(state);
    const restored = loadPersistedState();
    expect(restored.topic).toBe(state.topic);
    expect(restored.turns).toHaveLength(1);
    expect(restored.turns[0].content).toBe('first statement');
    expect(restored.turns[0].cli).toBe('codex');
    expect(restored.turns[0].stance).toBe('pro');
  });

  it('returns null when current key absent', () => {
    expect(loadPersistedState()).toBeNull();
  });

  it('tolerates corrupted JSON by returning null', () => {
    localStorage.setItem(CURRENT_KEY, 'not-json');
    expect(loadPersistedState()).toBeNull();
  });
});

describe('Single Slot Only With No Historical Debate Storage', () => {
  it('new state overwrites previous current slot', () => {
    const s1 = createInitialDebateState({
      topic: 'first',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    savePersistedState(s1);
    const s2 = createInitialDebateState({
      topic: 'second',
      proSide: 'claude',
      perSideCount: 5,
      firstSpeakerStance: 'con',
      effortLevel: 'high',
    });
    savePersistedState(s2);

    // 只剩一個 current key
    const keys = Object.keys(localStorage);
    const currentKeys = keys.filter((k) => k.startsWith('spectra-debate:current'));
    expect(currentKeys).toEqual([CURRENT_KEY]);
    // 內容已被覆寫
    expect(loadPersistedState().topic).toBe('second');
  });

  it('lastFormValues + current are the ONLY two keys touched', () => {
    saveLastFormValues({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    const s = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    savePersistedState(s);
    const keys = Object.keys(localStorage).sort();
    expect(keys).toEqual([CURRENT_KEY, LAST_FORM_VALUES_KEY].sort());
  });
});

describe('determineInitialView (Page Load Routes the User Based on Persisted State)', () => {
  function makeState(overrides = {}) {
    return {
      ...createInitialDebateState({
        topic: 't',
        proSide: 'codex',
        perSideCount: 3,
        firstSpeakerStance: 'pro',
        effortLevel: 'medium',
      }),
      ...overrides,
    };
  }

  it('null state → setup view', () => {
    expect(determineInitialView(null)).toBe('setup');
  });

  it('empty turns no endedAt → setup view', () => {
    const s = makeState();
    expect(s.turns).toEqual([]);
    expect(s.endedAt).toBeUndefined();
    expect(determineInitialView(s)).toBe('setup');
  });

  it('turns non-empty, endedAt set → ended-completed view', () => {
    const s = makeState({
      turns: [{ index: 1, cli: 'codex', stance: 'pro', kind: 'debate', status: 'done', content: 'a' }],
      endedAt: new Date().toISOString(),
      endReason: 'completed',
    });
    expect(determineInitialView(s)).toBe('ended-completed');
  });

  it('turns non-empty, endedAt absent → ended-interrupted (不自動續跑)', () => {
    const s = makeState({
      turns: [{ index: 1, cli: 'codex', stance: 'pro', kind: 'debate', status: 'done', content: 'a' }],
      endedAt: undefined,
    });
    expect(determineInitialView(s)).toBe('ended-interrupted');
  });

  it('terminated state → ended-completed view（terminated 也算結束畫面）', () => {
    const s = makeState({
      turns: [{ index: 1, cli: 'codex', stance: 'pro', kind: 'debate', status: 'failed', content: '' }],
      endedAt: new Date().toISOString(),
      endReason: 'terminated',
    });
    expect(determineInitialView(s)).toBe('ended-completed');
  });
});

describe('Single Write Per savePersistedState Call', () => {
  it('savePersistedState writes exactly one key to localStorage', () => {
    const state = createInitialDebateState({
      topic: 't',
      proSide: 'codex',
      perSideCount: 3,
      firstSpeakerStance: 'pro',
      effortLevel: 'medium',
    });
    expect(Object.keys(localStorage)).toHaveLength(0);
    savePersistedState(state);
    expect(Object.keys(localStorage)).toEqual([CURRENT_KEY]);
    // 二次寫入仍是同一 key、無歷史 slot 出現
    state.turns.push({
      index: 1,
      cli: 'codex',
      stance: 'pro',
      kind: 'debate',
      status: 'done',
      content: 'x',
    });
    savePersistedState(state);
    expect(Object.keys(localStorage)).toEqual([CURRENT_KEY]);
    expect(loadPersistedState().turns).toHaveLength(1);
  });

  it('streaming-time non-writes are enforced by state machine layer (not persistence module)', () => {
    // 此模組僅提供存取，不負責 throttle / chunk 過濾。state-machine 層在
    // streaming → done / failed 的轉移時才會呼叫此函式。對應驗證在
    // state-machine 整合測試（手動 9.1）。
    expect(typeof savePersistedState).toBe('function');
  });
});
