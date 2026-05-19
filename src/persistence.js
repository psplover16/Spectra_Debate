// localStorage persistence — design.md「localStorage Schema」+
// 「持久化採 localStorage 單一 slot 而非 IndexedDB / 多場歷史」
// ----------------------------------------------------------------------------
// 暴露兩個 keys：
//   spectra-debate:current          — 當前 / 最後一場 DebateState
//   spectra-debate:lastFormValues   — 彈窗上次輸入（7 欄）
//
// 寫入時機由 state machine 控制（每 turn 完成、彈窗 confirm、辯論結束）；本模組僅提供
// 純粹存取，無內部 throttle / debounce。
// ----------------------------------------------------------------------------

export const CURRENT_KEY = 'spectra-debate:current';
export const LAST_FORM_VALUES_KEY = 'spectra-debate:lastFormValues';

const FORM_FIELDS = ['topic', 'proSide', 'proPersona', 'conPersona', 'perSideCount', 'firstSpeakerStance', 'effortLevel'];

export function savePersistedState(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
}

export function loadPersistedState() {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function clearPersistedState() {
  localStorage.removeItem(CURRENT_KEY);
}

export function saveLastFormValues(form) {
  const payload = {};
  for (const field of FORM_FIELDS) {
    payload[field] = form[field];
  }
  localStorage.setItem(LAST_FORM_VALUES_KEY, JSON.stringify(payload));
}

export function loadLastFormValues() {
  const raw = localStorage.getItem(LAST_FORM_VALUES_KEY);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * 依持久化狀態決定首屏路由。
 * @param {DebateState | null} state
 * @returns {'setup' | 'ended-completed' | 'ended-interrupted'}
 */
export function determineInitialView(state) {
  if (!state) return 'setup';
  const hasTurns = Array.isArray(state.turns) && state.turns.length > 0;
  if (!hasTurns) return 'setup';
  if (state.endedAt) return 'ended-completed';
  return 'ended-interrupted';
}
