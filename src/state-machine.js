// Debate state machine — design.md「狀態機轉移」
// ----------------------------------------------------------------------------
// 編排：依 turn plan 逐個 spawn CLI、訂閱 SSE、處理完成/失敗/終止。
//
// 二元控制模型（design.md「狀態機採自動推進 + 永久終止二元模型」）：
//   - 自動推進：turn 進入 done / failed 後立即啟動下一 turn
//   - 永久終止：terminate() 中止當前 child + 收場、不可續
//   - 失敗跳過（design.md「CLI 失敗採跳過 + 標註而非重試 / 終場」）：
//     非 0 exit / 逾時 / 空輸出 → 標 turn.failed 後仍推進
// ----------------------------------------------------------------------------

import { buildTurnPlan } from './turn-plan.js';
import { buildPrompt } from './prompt.js';
import { createTurn } from './state.js';

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {DebateState} state
 * @param {{
 *   bridgeClient: { startTurn, subscribe, abortTurn },
 *   savePersistedState: (state: DebateState) => void,
 *   onTurnStart?: (turn) => void,
 *   onChunk?: (turn, chunk: string) => void,
 *   onTurnEnd?: (turn) => void,
 *   onEnded?: (state) => void,
 * }} deps
 */
export function createDebateController(state, deps) {
  const plan = buildTurnPlan({
    firstSpeakerStance: state.firstSpeakerStance,
    perSideCount: state.perSideCount,
    proSide: state.proSide,
    conSide: state.conSide,
  });
  const totalTurns = plan.length;

  let terminated = false;
  let currentSubscription = null;
  let currentBridgeTurnId = null;
  let currentTurnResolve = null;

  function settleCurrentTurn() {
    const r = currentTurnResolve;
    currentTurnResolve = null;
    currentSubscription = null;
    currentBridgeTurnId = null;
    if (r) r();
  }

  function runTurn(turn, prompt) {
    return new Promise((resolve) => {
      currentTurnResolve = resolve;
      deps.bridgeClient
        .startTurn({
          cli: turn.cli,
          stance: turn.stance,
          prompt,
          effortLevel: state.effortLevel,
        })
        .then((turnId) => {
          if (terminated) {
            deps.bridgeClient.abortTurn(turnId).catch(() => {});
            if (turn.status === 'streaming') {
              turn.status = 'failed';
              turn.errorMessage = '使用者終止';
              turn.endedAt = nowIso();
            }
            settleCurrentTurn();
            return;
          }
          currentBridgeTurnId = turnId;
          currentSubscription = deps.bridgeClient.subscribe(turnId, {
            onChunk: (chunk) => {
              if (terminated) return;
              turn.content += chunk;
              deps.onChunk && deps.onChunk(turn, chunk);
            },
            onDone: () => {
              if (terminated) return;
              turn.status = 'done';
              turn.endedAt = nowIso();
              settleCurrentTurn();
            },
            onError: (msg) => {
              if (turn.status === 'streaming') {
                turn.status = 'failed';
                turn.errorMessage = msg;
                turn.endedAt = nowIso();
              }
              settleCurrentTurn();
            },
          });
        })
        .catch((err) => {
          turn.status = 'failed';
          turn.errorMessage = `Bridge error: ${err.message ?? String(err)}`;
          turn.endedAt = nowIso();
          settleCurrentTurn();
        });
    });
  }

  async function start() {
    deps.savePersistedState(state);

    for (let i = state.turns.length; i < plan.length; i += 1) {
      if (terminated) break;
      const planTurn = plan[i];
      const turn = createTurn({
        index: planTurn.index,
        cli: planTurn.cli,
        stance: planTurn.stance,
        kind: planTurn.kind,
      });
      turn.status = 'streaming';
      state.turns.push(turn);
      deps.onTurnStart && deps.onTurnStart(turn);

      const persona = turn.stance === 'pro' ? state.proPersona : state.conPersona;
      const prompt = buildPrompt({
        topic: state.topic,
        stance: turn.stance,
        cli: turn.cli,
        turnIndex: turn.index,
        totalTurns,
        kind: turn.kind,
        persona,
        history: state.turns.slice(0, i),
      });

      await runTurn(turn, prompt);

      // 確保終止時 status 已標為 failed
      if (terminated && turn.status === 'streaming') {
        turn.status = 'failed';
        turn.errorMessage = '使用者終止';
        turn.endedAt = nowIso();
      }

      deps.savePersistedState(state);
      deps.onTurnEnd && deps.onTurnEnd(turn);

      if (terminated) break;
    }

    state.endedAt = nowIso();
    state.endReason = terminated ? 'terminated' : 'completed';
    deps.savePersistedState(state);
    deps.onEnded && deps.onEnded(state);
  }

  function terminate() {
    if (terminated) return;
    terminated = true;
    const currentTurn = state.turns[state.turns.length - 1];
    if (currentTurn && currentTurn.status === 'streaming') {
      currentTurn.status = 'failed';
      currentTurn.errorMessage = '使用者終止';
      currentTurn.endedAt = nowIso();
    }
    if (currentBridgeTurnId) {
      const id = currentBridgeTurnId;
      deps.bridgeClient.abortTurn(id).catch(() => {});
    }
    if (currentSubscription && currentSubscription.close) {
      try {
        currentSubscription.close();
      } catch (_) {
        /* ignore */
      }
    }
    // 強制解開 pending 的 runTurn promise，避免 start() 的迴圈卡死
    settleCurrentTurn();
  }

  return {
    start,
    terminate,
    getPlan: () => plan,
    isTerminated: () => terminated,
  };
}
