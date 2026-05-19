// Prompt builder for codex / claude turn invocations
// ----------------------------------------------------------------------------
// 依當前 DebateState 與 turnIndex 組裝 prompt，包含：
//   - 標頭：辯題、立場（中文 label）、turnIndex、totalTurns、kind 五要素
//   - 歷史段：依時序渲染所有已完成 turn 的內容；失敗 turn 渲染為 placeholder
//   - 指令段：主辯版 vs 結辯版兩種模板
//
// 採完整歷史重塞策略（見 design.md「Prompt 脈絡採完整歷史重塞而非滾動視窗 / 摘要」），
// MVP 場景 N ≤ 5、共 ≤ 12 turn，估算總脈絡 ≤ 10k token，遠低於主流 CLI 上下文窗。
// ----------------------------------------------------------------------------

export const STANCE_LABEL = Object.freeze({
  pro: '正方',
  con: '反方',
});

const FAILED_TURN_PLACEHOLDER = '⚠ 該回合 CLI 失敗，無發言內容';

const MAIN_DEBATE_INSTRUCTIONS = [
  '現在輪到你發言。',
  '要求：',
  '- 必須緊扣辯題',
  '- 必須針對對手上一段發言的論點直接回應（若上一段為失敗，則延續你方此前論點推進）',
  '- 不得自相矛盾於你之前的立場',
  '- 約 200~400 字',
  '- 直接輸出辯論內容，不要任何前言、不要 markdown 標題、不要重複「正方/反方:」前綴',
].join('\n');

const CLOSING_INSTRUCTIONS = [
  '現在是你的結辯回合。',
  '要求：',
  '- 總結你方的核心論點（依本場已陳述的內容）',
  '- 反駁對方最關鍵的 1~2 個論點',
  '- 不得提出全新主張（結辯不開新戰線）',
  '- 約 300~500 字',
  '- 直接輸出，不要前言、不要 markdown、不要前綴',
].join('\n');

const KIND_LABEL = Object.freeze({
  debate: '主辯論',
  closing: '結辯',
});

function renderHistoryTurn(turn) {
  const stanceLabel = STANCE_LABEL[turn.stance];
  const header = `${stanceLabel}(${turn.cli}):`;
  if (turn.status === 'failed') {
    return `${header} ${FAILED_TURN_PLACEHOLDER}`;
  }
  return `${header} ${turn.content}`;
}

function renderHistoryBlock(history) {
  if (!history || history.length === 0) return '';
  const lines = ['---', '辯論歷史（依時序）：', ''];
  for (const turn of history) {
    lines.push(renderHistoryTurn(turn));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @param {Object} input
 * @param {string} input.topic
 * @param {'pro'|'con'} input.stance
 * @param {'codex'|'claude'} input.cli
 * @param {number} input.turnIndex 1-based
 * @param {number} input.totalTurns
 * @param {'debate'|'closing'} input.kind
 * @param {Array<{index:number, cli:string, stance:'pro'|'con', status:string, content?:string, errorMessage?:string}>} input.history
 *   完成的 prior turns（不含當前 turn）
 * @returns {string}
 */
export function buildPrompt(input) {
  const { topic, stance, turnIndex, totalTurns, kind, history } = input;
  const stanceLabel = STANCE_LABEL[stance];
  const kindLabel = KIND_LABEL[kind];

  const header = [
    '你正在參與一場辯論。',
    '',
    `辯題：${topic}`,
    `你的立場：${stanceLabel}`,
    `這是第 ${turnIndex} 個 turn（共 ${totalTurns} 個，含結辯）`,
    `本回合性質：${kindLabel}`,
  ].join('\n');

  const historyBlock = renderHistoryBlock(history);
  const instructions = kind === 'closing' ? CLOSING_INSTRUCTIONS : MAIN_DEBATE_INSTRUCTIONS;

  // 中段分隔線：如果有歷史就用 history 末尾的 '\n'，否則自加分隔
  const parts = [header];
  if (historyBlock) parts.push(historyBlock);
  parts.push('---');
  parts.push(instructions);
  return parts.join('\n');
}
