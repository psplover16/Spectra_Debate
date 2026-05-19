// Timeline UI rendering — design.md 「訊息卡 上下時間軸 + chip + 立場色 + 串流」
// ----------------------------------------------------------------------------
// 純粹的 DOM 渲染，無 state machine 邏輯。state machine 呼叫：
//   - renderTimeline(rootElement, turns)            初次/重新整理時全量渲染
//   - renderTurnCard(turn)                          建立單張卡，state machine 自行 append
//   - appendTurnContent(cardElement, chunk)         串流逐字 append
// ----------------------------------------------------------------------------

import { STANCE_LABEL } from './prompt.js';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch (_) {
    return '';
  }
}

/**
 * @param {Turn} turn
 * @returns {HTMLElement}
 */
export function renderTurnCard(turn) {
  const card = document.createElement('article');
  card.className = 'turn-card';
  card.dataset.turnIndex = String(turn.index);
  card.classList.add(turn.stance === 'pro' ? 'turn-card--pro' : 'turn-card--con');
  if (turn.kind === 'closing') card.classList.add('turn-card--closing');
  if (turn.status === 'failed') card.classList.add('turn-card--failed');
  if (turn.status === 'streaming') card.classList.add('turn-card--streaming');

  const header = document.createElement('header');
  header.className = 'turn-card__header';

  const chip = document.createElement('span');
  chip.className = 'turn-card__chip';
  const stanceLabel = STANCE_LABEL[turn.stance];
  const closingTag = turn.kind === 'closing' ? ' · 結辯' : '';
  chip.textContent = `${stanceLabel} · ${turn.cli}${closingTag}`;

  const time = document.createElement('time');
  time.className = 'turn-card__time';
  time.dateTime = turn.startedAt ?? '';
  time.textContent = formatTime(turn.startedAt);

  header.appendChild(chip);
  header.appendChild(time);

  const content = document.createElement('p');
  content.className = 'turn-card__content';
  if (turn.status === 'failed') {
    const errMsg = turn.errorMessage ?? '失敗';
    content.textContent = `⚠ ${errMsg}`;
  } else {
    content.textContent = turn.content ?? '';
  }

  card.appendChild(header);
  card.appendChild(content);
  return card;
}

/**
 * 在 cardElement 的 content 區追加文字（給 SSE chunk 串流用）。
 * @param {HTMLElement} cardElement
 * @param {string} chunk
 */
export function appendTurnContent(cardElement, chunk) {
  const content = cardElement.querySelector('.turn-card__content');
  if (!content) return;
  content.textContent = (content.textContent ?? '') + chunk;
}

/**
 * 將整個 turns 陣列渲染到 root（覆寫 root 內容）。
 * @param {HTMLElement} root
 * @param {Turn[]} turns
 */
export function renderTimeline(root, turns) {
  root.innerHTML = '';
  for (const turn of turns) {
    root.appendChild(renderTurnCard(turn));
  }
}
