// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSetupPopup } from '../src/setup.js';
import { CURRENT_KEY, LAST_FORM_VALUES_KEY } from '../src/persistence.js';

function getEl(selector) {
  return document.querySelector(selector);
}

function setValueAndDispatch(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="app-root"></div>';
});

describe('Debate Setup Popup Appears Before Each Debate', () => {
  it('renders popup with 5 fields when no lastFormValues', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    expect(getEl('[data-field="topic"]')).toBeTruthy();
    expect(getEl('[data-field="proSide"]')).toBeTruthy();
    expect(getEl('[data-field="perSideCount"]')).toBeTruthy();
    expect(getEl('[data-field="firstSpeakerStance"]')).toBeTruthy();
    expect(getEl('[data-field="effortLevel"]')).toBeTruthy();
    expect(getEl('[data-action="confirm"]')).toBeTruthy();
  });

  it('default values match spec: topic empty, proSide codex, N=3, firstSpeaker pro, effort medium', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    expect(getEl('[data-field="topic"]').value).toBe('');
    expect(getEl('[data-field="proSide"]').value).toBe('codex');
    expect(Number(getEl('[data-field="perSideCount"]').value)).toBe(3);
    expect(getEl('[data-field="firstSpeakerStance"]').value).toBe('pro');
    expect(getEl('[data-field="effortLevel"]').value).toBe('medium');
  });

  it('confirm button is disabled when topic is empty', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    const btn = getEl('[data-action="confirm"]');
    expect(btn.disabled).toBe(true);
  });

  it('confirm enables after typing valid topic', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    setValueAndDispatch(getEl('[data-field="topic"]'), '死刑是否應廢除');
    expect(getEl('[data-action="confirm"]').disabled).toBe(false);
  });

  it('confirm disables when topic too short (boundary 3)', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    setValueAndDispatch(getEl('[data-field="topic"]'), 'abc');
    expect(getEl('[data-action="confirm"]').disabled).toBe(true);
  });

  it('confirm enables at topic length 4 (boundary)', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    setValueAndDispatch(getEl('[data-field="topic"]'), 'abcd');
    expect(getEl('[data-action="confirm"]').disabled).toBe(false);
  });

  it('confirm disables at topic length 101 (boundary)', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    setValueAndDispatch(getEl('[data-field="topic"]'), 'a'.repeat(101));
    expect(getEl('[data-action="confirm"]').disabled).toBe(true);
  });
});

describe('Form Values Persist Across Sessions', () => {
  it('pre-fills from lastFormValues when present', () => {
    localStorage.setItem(
      LAST_FORM_VALUES_KEY,
      JSON.stringify({
        topic: '存放的辯題',
        proSide: 'claude',
        perSideCount: 5,
        firstSpeakerStance: 'con',
        effortLevel: 'high',
      })
    );
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    expect(getEl('[data-field="topic"]').value).toBe('存放的辯題');
    expect(getEl('[data-field="proSide"]').value).toBe('claude');
    expect(Number(getEl('[data-field="perSideCount"]').value)).toBe(5);
    expect(getEl('[data-field="firstSpeakerStance"]').value).toBe('con');
    expect(getEl('[data-field="effortLevel"]').value).toBe('high');
    // 確定鈕應已 enabled（topic 有效）
    expect(getEl('[data-action="confirm"]').disabled).toBe(false);
  });

  it('confirm writes lastFormValues + calls onConfirm with form values', () => {
    const onConfirm = vi.fn();
    renderSetupPopup(getEl('#app-root'), { onConfirm });
    setValueAndDispatch(getEl('[data-field="topic"]'), '新的辯題');
    setValueAndDispatch(getEl('[data-field="proSide"]'), 'claude');
    setValueAndDispatch(getEl('[data-field="perSideCount"]'), '4');
    setValueAndDispatch(getEl('[data-field="firstSpeakerStance"]'), 'con');
    setValueAndDispatch(getEl('[data-field="effortLevel"]'), 'xhigh');

    getEl('[data-action="confirm"]').click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      topic: '新的辯題',
      proSide: 'claude',
      perSideCount: 4,
      firstSpeakerStance: 'con',
      effortLevel: 'xhigh',
    });

    const stored = JSON.parse(localStorage.getItem(LAST_FORM_VALUES_KEY));
    expect(stored).toEqual({
      topic: '新的辯題',
      proSide: 'claude',
      perSideCount: 4,
      firstSpeakerStance: 'con',
      effortLevel: 'xhigh',
    });
  });

  it('does not touch CURRENT_KEY during popup interaction', () => {
    renderSetupPopup(getEl('#app-root'), { onConfirm: () => {} });
    setValueAndDispatch(getEl('[data-field="topic"]'), '某辯題');
    getEl('[data-action="confirm"]').click();
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
  });
});
