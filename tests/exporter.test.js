// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildExportHtml, buildExportFilename } from '../src/exporter.js';
import { createInitialDebateState, createTurn } from '../src/state.js';

function makeCompletedState(overrides = {}) {
  const state = createInitialDebateState({
    topic: '死刑是否應廢除',
    proSide: 'codex',
    perSideCount: 2,
    firstSpeakerStance: 'pro',
    effortLevel: 'medium',
  });
  state.startedAt = '2026-05-11T18:23:45.000Z';
  state.endedAt = '2026-05-11T18:35:12.000Z';
  state.endReason = 'completed';
  state.turns = [
    {
      ...createTurn({ index: 1, cli: 'codex', stance: 'pro', kind: 'debate' }),
      status: 'done',
      content: '正方第一段論述。',
      startedAt: '2026-05-11T18:24:00.000Z',
      endedAt: '2026-05-11T18:25:30.000Z',
    },
    {
      ...createTurn({ index: 2, cli: 'claude', stance: 'con', kind: 'debate' }),
      status: 'failed',
      errorMessage: 'CLI 逾時（90 秒未回應）',
      content: '',
      startedAt: '2026-05-11T18:25:35.000Z',
      endedAt: '2026-05-11T18:27:05.000Z',
    },
    {
      ...createTurn({ index: 3, cli: 'codex', stance: 'pro', kind: 'debate' }),
      status: 'done',
      content: '正方第二段。',
      startedAt: '2026-05-11T18:27:10.000Z',
      endedAt: '2026-05-11T18:28:40.000Z',
    },
    {
      ...createTurn({ index: 4, cli: 'claude', stance: 'con', kind: 'debate' }),
      status: 'done',
      content: '反方反駁。',
      startedAt: '2026-05-11T18:28:45.000Z',
      endedAt: '2026-05-11T18:30:15.000Z',
    },
    {
      ...createTurn({ index: 5, cli: 'codex', stance: 'pro', kind: 'closing' }),
      status: 'done',
      content: '正方結辯。',
      startedAt: '2026-05-11T18:30:20.000Z',
      endedAt: '2026-05-11T18:32:45.000Z',
    },
    {
      ...createTurn({ index: 6, cli: 'claude', stance: 'con', kind: 'closing' }),
      status: 'done',
      content: '反方結辯。',
      startedAt: '2026-05-11T18:32:50.000Z',
      endedAt: '2026-05-11T18:35:12.000Z',
    },
  ];
  return { ...state, ...overrides };
}

describe('buildExportFilename', () => {
  it('formats from startedAt as debate-YYYYMMDD-HHMM.html', () => {
    const filename = buildExportFilename('2026-05-11T18:23:45.000Z');
    // 時區可能影響但格式必定符合
    expect(filename).toMatch(/^debate-\d{8}-\d{4}\.html$/);
  });

  it('falls back to current time when startedAt invalid', () => {
    const filename = buildExportFilename('not a date');
    expect(filename).toMatch(/^debate-\d{8}-\d{4}\.html$/);
  });
});

describe('buildExportHtml — content guarantees (Q7a 全部包含)', () => {
  it('includes topic in title and h1', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    expect(html).toContain('<title>死刑是否應廢除 — 辯論紀錄</title>');
    expect(html).toMatch(/<h1>死刑是否應廢除<\/h1>/);
  });

  it('includes all 6 turns with content (含失敗 turn placeholder)', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    expect(html).toContain('正方第一段論述。');
    expect(html).toContain('正方第二段。');
    expect(html).toContain('反方反駁。');
    expect(html).toContain('正方結辯。');
    expect(html).toContain('反方結辯。');
    // 失敗 turn 顯示 errorMessage
    expect(html).toContain('CLI 逾時（90 秒未回應）');
  });

  it('includes setup metadata (N, 首發, effort)', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    expect(html).toMatch(/N=2/);
    expect(html).toMatch(/正方：codex/);
    expect(html).toMatch(/反方：claude/);
    expect(html).toMatch(/推理能力：medium/);
    expect(html).toMatch(/首發：正方/);
  });

  it('marks closing turns distinctly', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    // closing turn 的 chip 應含「結辯」標記
    expect(html).toMatch(/正方 · codex · 結辯/);
    expect(html).toMatch(/反方 · claude · 結辯/);
    // turn-card--closing class 也應出現
    expect(html).toContain('turn-card--closing');
  });

  it('renders failed turn with warning + retains stance/cli chip', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    // 失敗 turn 應有 failed class、且 chip 含立場+cli
    expect(html).toMatch(/turn-card--failed[\s\S]*反方 · claude/);
  });

  it('includes endReason indicator', () => {
    const completed = buildExportHtml(makeCompletedState());
    expect(completed).toContain('正常完成');

    const terminated = buildExportHtml(
      makeCompletedState({ endReason: 'terminated' })
    );
    expect(terminated).toContain('使用者終止');
  });

  it('is single self-contained html (no external link/script tags)', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).not.toMatch(/<link\s+[^>]*rel=["']stylesheet["']/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toContain('<style>');
  });

  it('escapes HTML special chars in topic to prevent injection', () => {
    const state = makeCompletedState({ topic: '<script>alert(1)</script>' });
    const html = buildExportHtml(state);
    expect(html).not.toMatch(/<title>[^<]*<script>alert/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('uses exportedAt parameter when provided', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state, {
      exportedAt: '2026-05-11T20:00:00.000Z',
    });
    // 時區會被本機規一化、但日期部分仍應出現
    expect(html).toMatch(/2026-05-11/);
  });
});

describe('buildExportHtml — failed-turn count in meta', () => {
  it('counts failed turns correctly', () => {
    const state = makeCompletedState();
    const html = buildExportHtml(state);
    // 範例 state 有 1 個失敗
    expect(html).toMatch(/失敗 1/);
  });
});
