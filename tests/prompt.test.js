import { describe, it, expect } from 'vitest';
import { buildPrompt, STANCE_LABEL } from '../src/prompt.js';

const baseInput = {
  topic: '死刑是否應該廢除',
  stance: 'pro',
  cli: 'codex',
  turnIndex: 1,
  totalTurns: 8,
  kind: 'debate',
  history: [],
};

describe('buildPrompt — header (Prompt Header Identifies Topic, Stance, Turn Index, Total Turn Count, and Kind)', () => {
  it('includes topic literally', () => {
    const out = buildPrompt({ ...baseInput, topic: '無條件基本收入是否應推行' });
    expect(out).toContain('無條件基本收入是否應推行');
  });

  it('includes stance label in 中文', () => {
    const proOut = buildPrompt({ ...baseInput, stance: 'pro' });
    expect(proOut).toContain(STANCE_LABEL.pro);
    expect(STANCE_LABEL.pro).toBe('正方');

    const conOut = buildPrompt({ ...baseInput, stance: 'con' });
    expect(conOut).toContain(STANCE_LABEL.con);
    expect(STANCE_LABEL.con).toBe('反方');
  });

  it('includes turn index and total turns as decimal integers', () => {
    const out = buildPrompt({ ...baseInput, turnIndex: 3, totalTurns: 8 });
    expect(out).toMatch(/第\s*3\s*個 turn/);
    expect(out).toMatch(/共\s*8\s*個/);
  });

  it('main debate prompt labels kind as 主辯論', () => {
    const out = buildPrompt({ ...baseInput, kind: 'debate' });
    expect(out).toContain('主辯論');
  });

  it('closing prompt labels kind as 結辯', () => {
    const out = buildPrompt({ ...baseInput, kind: 'closing' });
    expect(out).toContain('結辯');
    expect(out).not.toContain('本回合性質：主辯論');
  });
});

describe('buildPrompt — main debate variant (Main Debate Prompt Requires Direct Rebuttal and Non-Contradiction)', () => {
  it('contains explicit rebuttal instruction', () => {
    const out = buildPrompt({ ...baseInput, kind: 'debate' });
    expect(out).toMatch(/直接回應/);
  });

  it('contains explicit non-contradiction instruction', () => {
    const out = buildPrompt({ ...baseInput, kind: 'debate' });
    expect(out).toMatch(/不得自相矛盾/);
  });

  it('does not contain summary-only instruction (which belongs to closing)', () => {
    const out = buildPrompt({ ...baseInput, kind: 'debate' });
    expect(out).not.toMatch(/總結你方的核心論點/);
  });
});

describe('buildPrompt — closing variant (Closing Prompt Requires Summary and Rebuttal Without New Arguments)', () => {
  it('contains summary instruction', () => {
    const out = buildPrompt({ ...baseInput, kind: 'closing' });
    expect(out).toMatch(/總結/);
  });

  it('contains rebuttal instruction', () => {
    const out = buildPrompt({ ...baseInput, kind: 'closing' });
    expect(out).toMatch(/反駁/);
  });

  it('forbids brand-new arguments', () => {
    const out = buildPrompt({ ...baseInput, kind: 'closing' });
    expect(out).toMatch(/不得提出全新主張/);
  });
});

describe('buildPrompt — history (Each Turn Prompt Embeds the Full Prior Debate History)', () => {
  it('renders completed prior turns in chronological order with stance + cli labels', () => {
    const history = [
      { index: 1, cli: 'codex', stance: 'pro', status: 'done', kind: 'debate', content: '我方論點一。' },
      { index: 2, cli: 'claude', stance: 'con', status: 'done', kind: 'debate', content: '對方反駁一。' },
      { index: 3, cli: 'codex', stance: 'pro', status: 'done', kind: 'debate', content: '我方論點二。' },
      { index: 4, cli: 'claude', stance: 'con', status: 'done', kind: 'debate', content: '對方反駁二。' },
    ];
    const out = buildPrompt({
      ...baseInput,
      turnIndex: 5,
      history,
    });
    expect(out).toContain('我方論點一。');
    expect(out).toContain('對方反駁一。');
    expect(out).toContain('我方論點二。');
    expect(out).toContain('對方反駁二。');
    expect(out).toContain('正方(codex)');
    expect(out).toContain('反方(claude)');

    // chronological order
    const i1 = out.indexOf('我方論點一。');
    const i2 = out.indexOf('對方反駁一。');
    const i3 = out.indexOf('我方論點二。');
    const i4 = out.indexOf('對方反駁二。');
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect(i3).toBeLessThan(i4);
  });

  it('first turn (empty history) does not render a content history block', () => {
    const out = buildPrompt({ ...baseInput, turnIndex: 1, history: [] });
    expect(out).not.toContain('正方(codex):');
    expect(out).not.toContain('反方(claude):');
  });
});

describe('buildPrompt — failed turn placeholders (Failed Turns Appear in History as Explicit Placeholders)', () => {
  it('renders failed turn as placeholder, not as content', () => {
    const history = [
      { index: 1, cli: 'codex', stance: 'pro', status: 'done', kind: 'debate', content: '正常論點。' },
      {
        index: 2,
        cli: 'claude',
        stance: 'con',
        status: 'failed',
        kind: 'debate',
        content: '',
        errorMessage: 'CLI timeout (90 seconds)',
      },
    ];
    const out = buildPrompt({ ...baseInput, turnIndex: 3, history });
    expect(out).toContain('⚠ 該回合 CLI 失敗，無發言內容');
    // errorMessage 與失敗 turn 的 content 都不應出現在 prompt 內
    expect(out).not.toContain('CLI timeout (90 seconds)');
    // 失敗 turn 的 chip 標頭仍應存在
    expect(out).toContain('反方(claude)');
  });
});
