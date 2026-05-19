// Setup popup field validators
// ----------------------------------------------------------------------------
// design.md「彈窗（debate setup）」+ spec/debate-setup 對 Topic / N 範圍校驗的合約。
// ----------------------------------------------------------------------------

import { CLI_NAMES, STANCES, EFFORT_LEVELS } from './state.js';

export const TOPIC_MIN = 4;
export const TOPIC_MAX = 100;
export const PER_SIDE_MIN = 2;
export const PER_SIDE_MAX = 5;

function ok() {
  return { valid: true, message: '' };
}
function fail(message) {
  return { valid: false, message };
}

export function validateTopic(rawTopic) {
  if (typeof rawTopic !== 'string') return fail(`辯題需為字串`);
  const trimmed = rawTopic.trim();
  if (trimmed.length < TOPIC_MIN) {
    return fail(`辯題至少需 ${TOPIC_MIN} 字（目前 ${trimmed.length} 字）`);
  }
  if (trimmed.length > TOPIC_MAX) {
    return fail(`辯題最多 ${TOPIC_MAX} 字（目前 ${trimmed.length} 字）`);
  }
  return ok();
}

export function validatePerSideCount(value) {
  if (!Number.isInteger(value)) return fail(`每方發言次數需為整數`);
  if (value < PER_SIDE_MIN || value > PER_SIDE_MAX) {
    return fail(`每方發言次數需為 ${PER_SIDE_MIN}~${PER_SIDE_MAX}`);
  }
  return ok();
}

export function validateProSide(value) {
  if (!CLI_NAMES.includes(value)) return fail(`正方 CLI 須為 codex 或 claude`);
  return ok();
}

export function validateFirstSpeakerStance(value) {
  if (!STANCES.includes(value)) return fail(`首發立場須為 pro 或 con`);
  return ok();
}

export function validateEffortLevel(value) {
  if (!EFFORT_LEVELS.includes(value)) {
    return fail(`推理能力須為 ${EFFORT_LEVELS.join('/')} 之一`);
  }
  return ok();
}

export function validateSetupForm(form) {
  const checks = [
    validateTopic(form?.topic),
    validateProSide(form?.proSide),
    validatePerSideCount(form?.perSideCount),
    validateFirstSpeakerStance(form?.firstSpeakerStance),
    validateEffortLevel(form?.effortLevel),
  ];
  const failed = checks.find((c) => !c.valid);
  return failed ?? ok();
}
