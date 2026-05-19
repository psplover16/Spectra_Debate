// Turn plan generator — design.md「狀態機轉移」
// ----------------------------------------------------------------------------
// 依 firstSpeakerStance + perSideCount 產生完整 turn 計畫：
//   - 主辯總 turn 數 = perSideCount × 2，依 firstSpeakerStance 交替
//   - 主辯結束後加 2 個 closing turn，仍依 firstSpeakerStance 起頭
//   - 每筆 plan 含 { index, stance, cli, kind }
// ----------------------------------------------------------------------------

import { STANCES, CLI_NAMES } from './state.js';

const PER_SIDE_MIN = 2;
const PER_SIDE_MAX = 5;
const CLOSING_COUNT = 2;

function otherStance(stance) {
  return stance === 'pro' ? 'con' : 'pro';
}

/**
 * @param {{firstSpeakerStance:'pro'|'con', perSideCount:number,
 *          proSide:'codex'|'claude', conSide:'codex'|'claude'}} input
 * @returns {Array<{index:number, stance:'pro'|'con', cli:'codex'|'claude', kind:'debate'|'closing'}>}
 */
export function buildTurnPlan({ firstSpeakerStance, perSideCount, proSide, conSide }) {
  if (!STANCES.includes(firstSpeakerStance)) {
    throw new Error(`firstSpeakerStance must be pro/con, got: ${firstSpeakerStance}`);
  }
  if (!CLI_NAMES.includes(proSide) || !CLI_NAMES.includes(conSide) || proSide === conSide) {
    throw new Error(`proSide and conSide must be distinct codex/claude, got: ${proSide}, ${conSide}`);
  }
  if (
    !Number.isInteger(perSideCount) ||
    perSideCount < PER_SIDE_MIN ||
    perSideCount > PER_SIDE_MAX
  ) {
    throw new Error(`perSideCount must be integer ${PER_SIDE_MIN}~${PER_SIDE_MAX}, got: ${perSideCount}`);
  }

  const stanceToCli = { pro: proSide, con: conSide };
  const mainTotal = perSideCount * 2;
  const plan = [];
  let stance = firstSpeakerStance;
  for (let i = 1; i <= mainTotal; i += 1) {
    plan.push({
      index: i,
      stance,
      cli: stanceToCli[stance],
      kind: 'debate',
    });
    stance = otherStance(stance);
  }
  // closing：總 2 個，仍從 firstSpeakerStance 開始（與主辯起頭一致）
  let closingStance = firstSpeakerStance;
  for (let i = 1; i <= CLOSING_COUNT; i += 1) {
    plan.push({
      index: mainTotal + i,
      stance: closingStance,
      cli: stanceToCli[closingStance],
      kind: 'closing',
    });
    closingStance = otherStance(closingStance);
  }
  return plan;
}
