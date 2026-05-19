// Effort translation layer
// ----------------------------------------------------------------------------
// 兩 CLI 的原生 reasoning effort 級距與呼叫方式 — 已由 `claude --help` 與
// `codex --help` 直接查證（apply 階段於使用者環境跑過）：
//
//   claude：旗標 `--effort <level>`，值範圍 low / medium / high / xhigh / max
//           （第 4 級是 `xhigh` 含 h；早先傳達為 `xigh` 是誤報）
//
//   codex：透過 `codex exec -c model_reasoning_effort=<value>` 設定，
//          值範圍 minimal / low / medium / high / xhigh
//          codex 無 `max`、有 `minimal`
//
// UI 採名稱對齊策略（與 .spectra.yaml 慣例一致），5 級：
//   low / medium / high / xhigh / max
// codex 的 `minimal` 不暴露給 UI；UI「max」對 codex 封頂為 `xhigh`。
// ----------------------------------------------------------------------------

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

// 純粹的「UI 等級 → CLI 原生字面值」對照（測試用）
export const codexEffortValues = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh', // 含 h
  max: 'xhigh', // codex 無 max，封頂
});

export const claudeEffortValues = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh', // claude --help 親查 — 含 h（非 `xigh`）
  max: 'max',
});

/**
 * 建構單次呼叫該 CLI 所需的完整 args（不含命令本身）。
 * prompt 一律走 stdin，args 內絕無使用者輸入。
 *
 * @param {'codex'|'claude'} cli
 * @param {'low'|'medium'|'high'|'xhigh'|'max'} level
 * @returns {string[]}
 */
export function buildCliInvocation(cli, level) {
  if (!EFFORT_LEVELS.includes(level)) {
    throw new Error(`Unknown effort level: ${level}`);
  }
  if (cli === 'codex') {
    const value = codexEffortValues[level];
    // codex 非互動：`codex exec -c model_reasoning_effort=<value> --skip-git-repo-check`
    // prompt 經 stdin 餵入（不傳位置參數，避免命令注入面向）
    return [
      'exec',
      '--skip-git-repo-check',
      '-c',
      `model_reasoning_effort=${value}`,
    ];
  }
  if (cli === 'claude') {
    const value = claudeEffortValues[level];
    // claude 非互動：`claude --print --effort <value>`
    return ['--print', '--effort', value];
  }
  throw new Error(`Unknown cli: ${cli}`);
}
