// HTML exporter — Q7 系列決策（discuss 階段）：
//   - 全部包含（辯題、設定、發言、失敗紀錄、時間戳、結辯標示）
//   - 視覺照搬：CSS inline 進單一 self-contained .html
//   - 檔名 `debate-YYYYMMDD-HHMM.html`，時間取 startedAt
// ----------------------------------------------------------------------------

import { renderTimeline } from './timeline.js';
import { STANCE_LABEL } from './prompt.js';

const EMBEDDED_CSS = `
:root { --pro-hue: 210; --con-hue: 0; --bg: #f7f7f9; --fg: #1f2330; --muted: #6b7280; --card-radius: 10px; --gap: 14px; --max-width: 760px; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 32px; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei UI", sans-serif; line-height: 1.55; }
.export-root { max-width: var(--max-width); margin: 0 auto; }
.export-header { background: white; padding: 16px 18px; border-radius: var(--card-radius); margin-bottom: var(--gap); }
.export-header h1 { margin: 0 0 8px; font-size: 22px; }
.export-header__meta { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.7; }
.timeline { display: flex; flex-direction: column; gap: var(--gap); }
.turn-card { background: white; border-radius: var(--card-radius); padding: 14px 16px; border: 1px solid #e5e7eb; border-left-width: 4px; }
.turn-card__header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.turn-card__chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; color: white; }
.turn-card__time { font-size: 12px; color: var(--muted); }
.turn-card__content { margin: 0; white-space: pre-wrap; word-break: break-word; }
.turn-card--pro { border-left-color: hsl(var(--pro-hue) 75% 50%); }
.turn-card--pro .turn-card__chip { background: hsl(var(--pro-hue) 75% 45%); }
.turn-card--con { border-left-color: hsl(var(--con-hue) 70% 50%); }
.turn-card--con .turn-card__chip { background: hsl(var(--con-hue) 70% 45%); }
.turn-card--failed { background: #f3f4f6; border-left-color: #9ca3af; color: var(--muted); }
.turn-card--failed .turn-card__chip { background: #6b7280; }
.turn-card--closing { border-left-style: double; border-left-width: 6px; }
.export-footer { margin-top: 24px; text-align: center; color: var(--muted); font-size: 12px; }
`;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function buildExportFilename(startedAtIso) {
  let d;
  try {
    d = new Date(startedAtIso);
    if (Number.isNaN(d.getTime())) d = new Date();
  } catch (_) {
    d = new Date();
  }
  return `debate-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.html`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIso(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  } catch (_) {
    return '';
  }
}

function renderMetaParagraph(state, exportedAt) {
  const failedCount = state.turns.filter((t) => t.status === 'failed').length;
  const proSideLabel = `${STANCE_LABEL.pro}：${state.proSide}`;
  const conSideLabel = `${STANCE_LABEL.con}：${state.conSide}`;
  const endReasonLabel = state.endReason === 'terminated' ? '使用者終止' : (state.endReason === 'completed' ? '正常完成' : '未完成（中斷）');
  const lines = [
    `${proSideLabel} · ${conSideLabel}`,
    `每方發言次數 N=${state.perSideCount}（含結辯，共 ${state.turns.length} turn、失敗 ${failedCount}）`,
    `首發：${STANCE_LABEL[state.firstSpeakerStance]} · 推理能力：${state.effortLevel}`,
    `開始：${formatIso(state.startedAt)} · 結束：${formatIso(state.endedAt)} · 結束方式：${endReasonLabel}`,
    `匯出時間：${formatIso(exportedAt)}`,
  ];
  return lines.map(escapeHtml).join('<br />');
}

/**
 * 產出單一 self-contained HTML 字串。
 * @param {DebateState} state
 * @param {{ exportedAt?: string, doc?: Document }} [options]
 * @returns {string}
 */
export function buildExportHtml(state, options = {}) {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const doc = options.doc ?? globalThis.document;
  if (!doc) {
    throw new Error('document is required to build export HTML (run in browser or jsdom)');
  }
  // 直接重用 timeline.js 的渲染 — 確保視覺與畫面一致
  const timelineContainer = doc.createElement('div');
  timelineContainer.className = 'timeline';
  renderTimeline(timelineContainer, state.turns);
  const timelineHtml = timelineContainer.outerHTML;

  const title = escapeHtml(state.topic);
  const metaHtml = renderMetaParagraph(state, exportedAt);

  return [
    '<!doctype html>',
    '<html lang="zh-Hant">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${title} — 辯論紀錄</title>`,
    '<style>',
    EMBEDDED_CSS.trim(),
    '</style>',
    '</head>',
    '<body>',
    '<div class="export-root">',
    '<header class="export-header">',
    `<h1>${title}</h1>`,
    `<p class="export-header__meta">${metaHtml}</p>`,
    '</header>',
    timelineHtml,
    `<footer class="export-footer">由 Spectra-Debate 於 ${escapeHtml(formatIso(exportedAt))} 匯出</footer>`,
    '</div>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * 觸發瀏覽器下載匯出檔。需要 DOM（document、URL.createObjectURL、Blob）。
 * @param {DebateState} state
 * @returns {string} 已使用的檔名
 */
export function downloadExportHtml(state) {
  const exportedAt = new Date().toISOString();
  const html = buildExportHtml(state, { exportedAt });
  const filename = buildExportFilename(state.startedAt);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 給 browser 一點時間把資料寫到磁碟後再 revoke
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return filename;
}
