// Debate setup popup — design.md「彈窗（debate setup）」
// ----------------------------------------------------------------------------
// 5 欄位、即時校驗、確定按下 → 寫 lastFormValues + onConfirm 回呼。
// 不負責 CURRENT_KEY 寫入 — 那由 state machine 在彈窗確定後接手。
// ----------------------------------------------------------------------------

import { loadLastFormValues, saveLastFormValues } from './persistence.js';
import { validateSetupForm, TOPIC_MIN, TOPIC_MAX, PER_SIDE_MIN, PER_SIDE_MAX } from './validators.js';

const DEFAULTS = Object.freeze({
  topic: '',
  proSide: 'codex',
  perSideCount: 3,
  firstSpeakerStance: 'pro',
  effortLevel: 'medium',
});

function readForm(root) {
  return {
    topic: root.querySelector('[data-field="topic"]').value,
    proSide: root.querySelector('[data-field="proSide"]').value,
    proPersona: root.querySelector('[data-field="proPersona"]').value,
    conPersona: root.querySelector('[data-field="conPersona"]').value,
    perSideCount: Number(root.querySelector('[data-field="perSideCount"]').value),
    firstSpeakerStance: root.querySelector('[data-field="firstSpeakerStance"]').value,
    effortLevel: root.querySelector('[data-field="effortLevel"]').value,
  };
}

function updateValidity(root) {
  const form = readForm(root);
  const result = validateSetupForm(form);
  const confirmBtn = root.querySelector('[data-action="confirm"]');
  const hint = root.querySelector('[data-role="validation-hint"]');
  confirmBtn.disabled = !result.valid;
  if (!result.valid) {
    hint.textContent = result.message;
    hint.classList.add('setup-form__hint--error');
  } else {
    hint.textContent = '';
    hint.classList.remove('setup-form__hint--error');
  }
}

export function renderSetupPopup(root, { onConfirm }) {
  const initial = { ...DEFAULTS, ...(loadLastFormValues() ?? {}) };
  root.innerHTML = `
    <section class="setup-popup">
      <h1 class="setup-popup__title">開始一場辯論</h1>
      <form class="setup-form" novalidate>
        <label class="setup-form__row">
          <span class="setup-form__label">辯題（${TOPIC_MIN}~${TOPIC_MAX} 字）</span>
          <input data-field="topic" type="text" maxlength="${TOPIC_MAX + 10}" />
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">哪個 CLI 當正方</span>
          <select data-field="proSide">
            <option value="codex">codex</option>
            <option value="claude">claude</option>
          </select>
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">正方身分（選填）</span>
          <input data-field="proPersona" type="text" placeholder="例如：Junior 前端工程師" />
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">反方身分（選填）</span>
          <input data-field="conPersona" type="text" placeholder="例如：高中生" />
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">每方發言次數（${PER_SIDE_MIN}~${PER_SIDE_MAX}）</span>
          <input data-field="perSideCount" type="number" min="${PER_SIDE_MIN}" max="${PER_SIDE_MAX}" step="1" />
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">誰先發言</span>
          <select data-field="firstSpeakerStance">
            <option value="pro">正方</option>
            <option value="con">反方</option>
          </select>
        </label>

        <label class="setup-form__row">
          <span class="setup-form__label">推理能力</span>
          <select data-field="effortLevel">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="xhigh">特高</option>
            <option value="max">最高</option>
          </select>
        </label>

        <p class="setup-form__hint" data-role="validation-hint"></p>

        <button class="setup-form__submit" data-action="confirm" type="button">開始辯論</button>
      </form>
    </section>
  `;

  // 套用初始值
  root.querySelector('[data-field="topic"]').value = initial.topic ?? '';
  root.querySelector('[data-field="proSide"]').value = initial.proSide ?? DEFAULTS.proSide;
  root.querySelector('[data-field="proPersona"]').value = initial.proPersona ?? '';
  root.querySelector('[data-field="conPersona"]').value = initial.conPersona ?? '';
  root.querySelector('[data-field="perSideCount"]').value = String(initial.perSideCount ?? DEFAULTS.perSideCount);
  root.querySelector('[data-field="firstSpeakerStance"]').value = initial.firstSpeakerStance ?? DEFAULTS.firstSpeakerStance;
  root.querySelector('[data-field="effortLevel"]').value = initial.effortLevel ?? DEFAULTS.effortLevel;

  // 即時校驗
  for (const field of ['topic', 'proSide', 'proPersona', 'conPersona', 'perSideCount', 'firstSpeakerStance', 'effortLevel']) {
    const el = root.querySelector(`[data-field="${field}"]`);
    el.addEventListener('input', () => updateValidity(root));
    el.addEventListener('change', () => updateValidity(root));
  }
  updateValidity(root);

  // 確定按下
  root.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const form = readForm(root);
    const result = validateSetupForm(form);
    if (!result.valid) return;
    saveLastFormValues(form);
    onConfirm(form);
  });
}
