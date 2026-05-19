// Core types and factories for the debate runtime
// ----------------------------------------------------------------------------
// design.md「核心型別（強制資料層雙欄位）」：
//   Turn 必同時帶 cli 與 stance 兩獨立欄位，不得 derive 任一從另一。
// 這是 openspec/config.yaml 「發言紀錄資料結構必須同時保存『CLI 名稱』與
// 『該回合的立場』」的程式碼層落實。
// ----------------------------------------------------------------------------

export const STANCES = Object.freeze(['pro', 'con']);
export const CLI_NAMES = Object.freeze(['codex', 'claude']);
export const EFFORT_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
export const TURN_STATUSES = Object.freeze(['pending', 'streaming', 'done', 'failed']);
export const TURN_KINDS = Object.freeze(['debate', 'closing']);
export const END_REASONS = Object.freeze(['completed', 'terminated']);

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join('/')}, got: ${value}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create a new Turn object.
 * @param {{index:number, cli:'codex'|'claude', stance:'pro'|'con', kind:'debate'|'closing'}} input
 * @returns {Turn}
 */
export function createTurn(input) {
  if (!Number.isInteger(input.index) || input.index < 1) {
    throw new Error(`index must be a positive integer, got: ${input.index}`);
  }
  assertEnum(input.cli, CLI_NAMES, 'cli');
  assertEnum(input.stance, STANCES, 'stance');
  assertEnum(input.kind, TURN_KINDS, 'kind');
  return {
    index: input.index,
    cli: input.cli,
    stance: input.stance,
    kind: input.kind,
    content: '',
    status: 'pending',
    errorMessage: undefined,
    startedAt: nowIso(),
    endedAt: undefined,
  };
}

/**
 * Create the initial DebateState when the user confirms the setup popup.
 * @param {{topic:string, proSide:'codex'|'claude', perSideCount:number,
 *          firstSpeakerStance:'pro'|'con', effortLevel:string}} input
 * @returns {DebateState}
 */
export function createInitialDebateState(input) {
  assertEnum(input.proSide, CLI_NAMES, 'proSide');
  assertEnum(input.firstSpeakerStance, STANCES, 'firstSpeakerStance');
  assertEnum(input.effortLevel, EFFORT_LEVELS, 'effortLevel');
  if (!Number.isInteger(input.perSideCount) || input.perSideCount < 2 || input.perSideCount > 5) {
    throw new Error(`perSideCount must be integer 2~5, got: ${input.perSideCount}`);
  }
  const conSide = input.proSide === 'codex' ? 'claude' : 'codex';
  return {
    topic: input.topic,
    proSide: input.proSide,
    conSide,
    perSideCount: input.perSideCount,
    firstSpeakerStance: input.firstSpeakerStance,
    effortLevel: input.effortLevel,
    turns: [],
    startedAt: nowIso(),
    endedAt: undefined,
    endReason: undefined,
    exported: false,
  };
}
