// Spectra-Debate frontend entry
// ----------------------------------------------------------------------------
// 載入時依持久化狀態決定畫面：
//   - 無 current → 顯示彈窗
//   - turns 非空 + endedAt 存在 → 顯示已結束畫面
//   - turns 非空 + 無 endedAt → 顯示中斷結束畫面（design.md「載入時不自動續跑」）
// 彈窗確定 → 建立 DebateState → 啟動 state machine → 渲染時間軸
// ----------------------------------------------------------------------------

import { renderSetupPopup } from './src/setup.js';
import { createDebateController } from './src/state-machine.js';
import { createBridgeClient } from './src/bridge-client.js';
import {
  renderTurnCard,
  appendTurnContent,
  renderTimeline,
} from './src/timeline.js';
import {
  loadPersistedState,
  savePersistedState,
  determineInitialView,
} from './src/persistence.js';
import { createInitialDebateState } from './src/state.js';
import { downloadExportHtml } from './src/exporter.js';

const APP_ROOT = document.getElementById('app-root');
const DEFAULT_BRIDGE_BASE = `http://127.0.0.1:7456`;

function resolveBridgeBaseUrl() {
  // 若頁面本身來自 127.0.0.1:port，使用相同 origin；否則用 7456 預設。
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.protocol.startsWith('http') &&
    window.location.hostname === '127.0.0.1'
  ) {
    return window.location.origin;
  }
  return DEFAULT_BRIDGE_BASE;
}

function clearRoot() {
  APP_ROOT.innerHTML = '';
}

function showConfirmRestartDialog(onProceed) {
  // onProceed(action) — action ∈ 'export-then-restart' | 'restart-now' | 'cancel'
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog" role="dialog" aria-modal="true">
      <p class="confirm-dialog__message">
        上一場辯論尚未匯出。
        <br />重新開始會覆寫目前的紀錄，要先匯出 HTML 嗎？
      </p>
      <div class="confirm-dialog__actions">
        <button data-confirm="export-then-restart" class="confirm-dialog__btn confirm-dialog__btn--primary">匯出後再開始</button>
        <button data-confirm="restart-now" class="confirm-dialog__btn">直接開始（不匯出）</button>
        <button data-confirm="cancel" class="confirm-dialog__btn confirm-dialog__btn--ghost">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  function close(action) {
    overlay.remove();
    onProceed(action);
  }
  overlay.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', () => close(btn.dataset.confirm));
  });
}

function renderEndedScreen(state, { onRestart }) {
  clearRoot();
  const view = determineInitialView(state);
  const notice = document.createElement('p');
  notice.className =
    view === 'ended-interrupted'
      ? 'ended-screen__notice ended-screen__notice--interrupted'
      : 'ended-screen__notice';
  const failedCount = state.turns.filter((t) => t.status === 'failed').length;
  if (view === 'ended-interrupted') {
    notice.textContent = `⚠ 上次未完成（中斷於 turn ${state.turns.length}）。重新整理不會自動續跑。`;
  } else if (state.endReason === 'terminated') {
    notice.textContent = `辯論已由使用者終止（共 ${state.turns.length} turn，其中 ${failedCount} 失敗）。`;
  } else {
    notice.textContent = `辯論已完成（共 ${state.turns.length} turn，其中 ${failedCount} 失敗）。`;
  }

  const screen = document.createElement('section');
  screen.className = 'ended-screen';
  screen.appendChild(notice);

  const actions = document.createElement('div');
  actions.className = 'ended-screen__actions';

  const restartBtn = document.createElement('button');
  restartBtn.className = 'ended-screen__action ended-screen__action--primary';
  restartBtn.textContent = '重新開始';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'ended-screen__action';
  exportBtn.textContent = state.exported ? '✓ 已匯出 HTML（再匯一次）' : '匯出 HTML';

  function performExport() {
    try {
      const filename = downloadExportHtml(state);
      state.exported = true;
      savePersistedState(state);
      exportBtn.textContent = `✓ 已匯出 ${filename}（再匯一次）`;
    } catch (err) {
      console.error('Export failed:', err);
      alert(`匯出失敗：${err.message ?? err}`);
    }
  }

  exportBtn.addEventListener('click', performExport);

  restartBtn.addEventListener('click', () => {
    if (state.exported) {
      onRestart();
      return;
    }
    showConfirmRestartDialog((action) => {
      if (action === 'cancel') return;
      if (action === 'export-then-restart') {
        performExport();
      }
      onRestart();
    });
  });

  actions.appendChild(restartBtn);
  actions.appendChild(exportBtn);
  screen.appendChild(actions);

  APP_ROOT.appendChild(screen);

  // 把時間軸也顯示出來（保留現場）
  const timelineRoot = document.createElement('div');
  timelineRoot.className = 'timeline';
  renderTimeline(timelineRoot, state.turns);
  APP_ROOT.appendChild(timelineRoot);
}

function runDebate(initialState) {
  clearRoot();

  // 頂部 header（狀態 + 終止鈕）
  const header = document.createElement('header');
  header.className = 'debate-header';
  const status = document.createElement('span');
  status.className = 'debate-header__status';
  status.textContent = `⚪ 辯論進行中（turn ${initialState.turns.length} / ?）`;
  const terminateBtn = document.createElement('button');
  terminateBtn.className = 'debate-header__terminate';
  terminateBtn.textContent = '終止';
  terminateBtn.type = 'button';
  header.appendChild(status);
  header.appendChild(terminateBtn);
  APP_ROOT.appendChild(header);

  const timelineRoot = document.createElement('div');
  timelineRoot.className = 'timeline';
  APP_ROOT.appendChild(timelineRoot);

  const cardByIndex = new Map();
  const bridge = createBridgeClient({ baseUrl: resolveBridgeBaseUrl() });
  const controller = createDebateController(initialState, {
    bridgeClient: bridge,
    savePersistedState,
    onTurnStart(turn) {
      if (!turn) return;
      const card = renderTurnCard(turn);
      cardByIndex.set(turn.index, card);
      timelineRoot.appendChild(card);
    },
    onChunk(turn, chunk) {
      const card = cardByIndex.get(turn.index);
      if (card) appendTurnContent(card, chunk);
    },
    onTurnEnd(turn) {
      const card = cardByIndex.get(turn.index);
      if (!card) return;
      // 替換為定稿版（保留狀態 class）
      const replacement = renderTurnCard(turn);
      card.replaceWith(replacement);
      cardByIndex.set(turn.index, replacement);
      const totalTurns = controller.getPlan().length;
      status.textContent = `⚪ 辯論進行中（turn ${initialState.turns.length} / ${totalTurns}）`;
    },
    onEnded(state) {
      renderEndedScreen(state, { onRestart: () => bootstrap(true) });
    },
  });

  terminateBtn.addEventListener('click', () => {
    terminateBtn.disabled = true;
    controller.terminate();
  });

  controller.start();
}

function bootstrap(forceSetup = false) {
  if (forceSetup) {
    clearRoot();
    renderSetupPopup(APP_ROOT, {
      onConfirm(form) {
        const state = createInitialDebateState(form);
        savePersistedState(state);
        runDebate(state);
      },
    });
    return;
  }

  const persisted = loadPersistedState();
  const view = determineInitialView(persisted);
  if (view === 'setup') {
    renderSetupPopup(APP_ROOT, {
      onConfirm(form) {
        const state = createInitialDebateState(form);
        savePersistedState(state);
        runDebate(state);
      },
    });
  } else {
    // 不自動續跑、直接顯示結束畫面（含中斷標記情境）
    renderEndedScreen(persisted, { onRestart: () => bootstrap(true) });
  }
}

if (typeof window !== 'undefined') {
  bootstrap();
}
