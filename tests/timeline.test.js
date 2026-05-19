// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderTurnCard,
  renderTimeline,
  appendTurnContent,
} from '../src/timeline.js';

function mkTurn(overrides = {}) {
  return {
    index: 1,
    cli: 'codex',
    stance: 'pro',
    kind: 'debate',
    status: 'done',
    content: 'sample content',
    startedAt: '2026-05-11T18:23:45.000Z',
    endedAt: '2026-05-11T18:24:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Messages Render in Vertical Time-Ordered Timeline', () => {
  it('renderTimeline outputs cards in turn.index order', () => {
    const root = document.createElement('div');
    const turns = [
      mkTurn({ index: 1, content: 'first' }),
      mkTurn({ index: 2, cli: 'claude', stance: 'con', content: 'second' }),
      mkTurn({ index: 3, content: 'third' }),
    ];
    renderTimeline(root, turns);
    const cards = root.querySelectorAll('.turn-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('first');
    expect(cards[1].textContent).toContain('second');
    expect(cards[2].textContent).toContain('third');
  });

  it('uses vertical block layout (no left-right flex split between pro/con)', () => {
    const root = document.createElement('div');
    renderTimeline(root, [mkTurn({ stance: 'pro' }), mkTurn({ index: 2, stance: 'con' })]);
    // 兩張卡都是 block / full-width；沒有 align-self: flex-start vs flex-end 的分裂
    const cards = root.querySelectorAll('.turn-card');
    for (const card of cards) {
      // 沒套用任何 alignment-based class（左右分欄會用 .turn-card--align-left/right 之類）
      expect(card.className).not.toMatch(/align-left|align-right|flex-start|flex-end/);
    }
  });
});

describe('Pro and Con Use Distinct Color Schemes', () => {
  it('pro turn carries class turn-card--pro', () => {
    const el = renderTurnCard(mkTurn({ stance: 'pro' }));
    expect(el.classList.contains('turn-card--pro')).toBe(true);
    expect(el.classList.contains('turn-card--con')).toBe(false);
  });

  it('con turn carries class turn-card--con', () => {
    const el = renderTurnCard(mkTurn({ stance: 'con' }));
    expect(el.classList.contains('turn-card--con')).toBe(true);
    expect(el.classList.contains('turn-card--pro')).toBe(false);
  });
});

describe('Each Message Card Has a Chip Header Identifying Stance and CLI', () => {
  it('pro/codex chip contains 正方 and codex', () => {
    const el = renderTurnCard(mkTurn({ stance: 'pro', cli: 'codex' }));
    const chip = el.querySelector('.turn-card__chip');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('正方');
    expect(chip.textContent).toContain('codex');
  });

  it('con/claude chip contains 反方 and claude', () => {
    const el = renderTurnCard(mkTurn({ stance: 'con', cli: 'claude' }));
    const chip = el.querySelector('.turn-card__chip');
    expect(chip.textContent).toContain('反方');
    expect(chip.textContent).toContain('claude');
  });

  it('chip is in upper-left, time is in upper-right, content below (DOM order)', () => {
    const el = renderTurnCard(mkTurn());
    const chip = el.querySelector('.turn-card__chip');
    const time = el.querySelector('.turn-card__time');
    const content = el.querySelector('.turn-card__content');
    expect(chip).toBeTruthy();
    expect(time).toBeTruthy();
    expect(content).toBeTruthy();
    // 結構順序：chip 在 time 之前（同層 header），content 在 header 之後
    expect(chip.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Streaming Content Renders Incrementally', () => {
  it('appendTurnContent appends to the .turn-card__content element', () => {
    const el = renderTurnCard(mkTurn({ status: 'streaming', content: '' }));
    appendTurnContent(el, 'Hello');
    expect(el.querySelector('.turn-card__content').textContent).toBe('Hello');
    appendTurnContent(el, ' ');
    expect(el.querySelector('.turn-card__content').textContent).toBe('Hello ');
    appendTurnContent(el, 'World');
    expect(el.querySelector('.turn-card__content').textContent).toBe('Hello World');
  });
});

describe('Failed Turns Render as Distinct Warning Cards', () => {
  it('failed turn has turn-card--failed class and warning marker', () => {
    const el = renderTurnCard(
      mkTurn({ status: 'failed', content: '', errorMessage: 'CLI 逾時（90 秒未回應）' })
    );
    expect(el.classList.contains('turn-card--failed')).toBe(true);
    // chip 仍含 stance + cli
    expect(el.querySelector('.turn-card__chip').textContent).toContain('正方');
    expect(el.querySelector('.turn-card__chip').textContent).toContain('codex');
    // 內文位置顯示警示 + errorMessage
    const content = el.querySelector('.turn-card__content');
    expect(content.textContent).toMatch(/[⚠！]/);
    expect(content.textContent).toContain('CLI 逾時（90 秒未回應）');
  });
});

describe('Closing Turns Are Marked in the Chip Header', () => {
  it('closing turn chip contains a closing marker (結辯) absent from debate chip', () => {
    const closingEl = renderTurnCard(mkTurn({ kind: 'closing' }));
    const debateEl = renderTurnCard(mkTurn({ kind: 'debate' }));
    const closingChip = closingEl.querySelector('.turn-card__chip').textContent;
    const debateChip = debateEl.querySelector('.turn-card__chip').textContent;
    expect(closingChip).toContain('結辯');
    expect(debateChip).not.toContain('結辯');
  });

  it('closing turn has turn-card--closing class', () => {
    const el = renderTurnCard(mkTurn({ kind: 'closing' }));
    expect(el.classList.contains('turn-card--closing')).toBe(true);
  });
});
