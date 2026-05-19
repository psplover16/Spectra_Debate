// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createDebateController } from '../src/state-machine.js';
import { createInitialDebateState } from '../src/state.js';

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

function makeMockBridgeClient() {
  /** @type {{ callbacks: { onChunk:Function, onDone:Function, onError:Function } } | null} */
  let pending = null;
  const startTurnCalls = [];
  const abortCalls = [];

  const client = {
    startTurn: vi.fn(({ cli, stance, prompt, effortLevel }) => {
      const turnId = `mock-${startTurnCalls.length + 1}`;
      startTurnCalls.push({ turnId, cli, stance, prompt, effortLevel });
      return Promise.resolve(turnId);
    }),
    subscribe: vi.fn((turnId, callbacks) => {
      pending = { turnId, callbacks };
      return {
        close: vi.fn(() => {
          if (pending && pending.turnId === turnId) pending = null;
        }),
      };
    }),
    abortTurn: vi.fn((turnId) => {
      abortCalls.push(turnId);
      return Promise.resolve();
    }),
  };

  return {
    client,
    completeWithDone: () => {
      if (!pending) throw new Error('no pending subscription');
      const cb = pending.callbacks;
      pending = null;
      cb.onDone();
    },
    completeWithError: (msg) => {
      if (!pending) throw new Error('no pending subscription');
      const cb = pending.callbacks;
      pending = null;
      cb.onError(msg);
    },
    pushChunk: (c) => {
      if (!pending) throw new Error('no pending subscription');
      pending.callbacks.onChunk(c);
    },
    startTurnCalls,
    abortCalls,
    isPending: () => pending !== null,
  };
}

function freshState() {
  return createInitialDebateState({
    topic: 'topic',
    proSide: 'codex',
    perSideCount: 2,
    firstSpeakerStance: 'pro',
    effortLevel: 'medium',
  });
}

describe('Automatic Advancement After Each Turn Completes', () => {
  it('auto-advances to next turn when current completes with done', async () => {
    const { client, completeWithDone, startTurnCalls } = makeMockBridgeClient();
    const state = freshState(); // perSideCount=2 → 6 turn plan
    const saves = vi.fn();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: saves,
    });
    const finished = controller.start();

    await flush();
    expect(startTurnCalls).toHaveLength(1);
    expect(state.turns[0].stance).toBe('pro');
    expect(state.turns[0].status).toBe('streaming');

    state.turns[0].content = 'content1';
    completeWithDone();
    await flush();
    expect(state.turns[0].status).toBe('done');
    expect(state.turns).toHaveLength(2); // next turn started
    expect(state.turns[1].stance).toBe('con');
    expect(state.turns[1].status).toBe('streaming');

    // 跑完剩餘 4 個 turn 進入結束
    for (let i = 1; i < 6; i += 1) {
      state.turns[i].content = `content${i + 1}`;
      completeWithDone();
      await flush();
    }
    await finished;
    expect(state.endedAt).toBeTruthy();
    expect(state.endReason).toBe('completed');
    expect(state.turns).toHaveLength(6);
    expect(state.turns.map((t) => t.kind)).toEqual([
      'debate',
      'debate',
      'debate',
      'debate',
      'closing',
      'closing',
    ]);
  });

  it('streaming chunks update turn.content and trigger onChunk callback', async () => {
    const { client, pushChunk, completeWithDone } = makeMockBridgeClient();
    const state = freshState();
    const onChunk = vi.fn();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: () => {},
      onChunk,
    });
    controller.start();
    await flush();

    pushChunk('Hello');
    pushChunk(' ');
    pushChunk('World');
    expect(state.turns[0].content).toBe('Hello World');
    expect(onChunk).toHaveBeenCalledTimes(3);
    completeWithDone();
    await flush();
    controller.terminate(); // stop the run cleanly
    await flush();
  });
});

describe('CLI Failure or Timeout Skips the Turn Without Terminating the Debate', () => {
  it('failed turn is marked failed and next turn still starts', async () => {
    const { client, completeWithError, completeWithDone, startTurnCalls } = makeMockBridgeClient();
    const state = freshState();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: () => {},
    });
    const finished = controller.start();
    await flush();

    completeWithError('CLI timeout (90 seconds elapsed)');
    await flush();
    expect(state.turns[0].status).toBe('failed');
    expect(state.turns[0].errorMessage).toMatch(/timeout/i);
    expect(state.turns).toHaveLength(2);
    expect(state.turns[1].status).toBe('streaming');
    expect(state.endedAt).toBeUndefined(); // 辯論未終止

    // 完成剩下的
    for (let i = 1; i < 6; i += 1) {
      state.turns[i].content = 'ok';
      completeWithDone();
      await flush();
    }
    await finished;
    expect(state.endReason).toBe('completed');
    expect(startTurnCalls).toHaveLength(6); // 失敗 turn 也算「啟動過」、不重試
  });
});

describe('Terminate Button Is the Only User Flow Control During Running Debate', () => {
  it('terminate() aborts current turn, marks it failed, and ends the debate with endReason=terminated', async () => {
    const { client, abortCalls } = makeMockBridgeClient();
    const state = freshState();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: () => {},
    });
    controller.start();
    await flush();
    expect(state.turns).toHaveLength(1);

    controller.terminate();
    await flush();
    await flush();

    expect(abortCalls).toHaveLength(1);
    expect(state.endedAt).toBeTruthy();
    expect(state.endReason).toBe('terminated');
    expect(state.turns).toHaveLength(1); // 後續 turn 不再 spawn
    expect(state.turns[0].status).toBe('failed');
    expect(state.turns[0].errorMessage).toMatch(/使用者終止|terminated/);
  });

  it('terminate after multiple completed turns ends without spawning more', async () => {
    const { client, completeWithDone, abortCalls } = makeMockBridgeClient();
    const state = freshState();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: () => {},
    });
    controller.start();
    await flush();
    // 跑 2 個 turn 後終止
    completeWithDone();
    await flush();
    completeWithDone();
    await flush();
    expect(state.turns).toHaveLength(3);

    controller.terminate();
    await flush();
    await flush();
    expect(state.endReason).toBe('terminated');
    expect(state.turns.length).toBeLessThan(6); // 沒跑完整 plan
    expect(abortCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('savePersistedState 寫入時機', () => {
  it('writes after each turn completes (done or failed), plus at end', async () => {
    const { client, completeWithDone } = makeMockBridgeClient();
    const state = freshState();
    const saves = vi.fn();
    const controller = createDebateController(state, {
      bridgeClient: client,
      savePersistedState: saves,
    });
    const finished = controller.start();
    await flush();
    const initialCalls = saves.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1); // 開場至少寫一次

    for (let i = 0; i < 6; i += 1) {
      completeWithDone();
      await flush();
    }
    await finished;
    // 每 turn 完成寫一次 + 結束寫一次
    expect(saves.mock.calls.length).toBeGreaterThanOrEqual(initialCalls + 6);
  });
});
