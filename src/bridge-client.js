// Browser-side bridge client — wraps fetch + EventSource for state-machine
// ----------------------------------------------------------------------------
// 對外暴露三個方法：
//   startTurn({cli, stance, prompt, effortLevel}) -> Promise<turnId>
//   subscribe(turnId, { onChunk, onDone, onError }) -> { close }
//   abortTurn(turnId) -> Promise<void>
// 注入 fetch / EventSource 以利測試；瀏覽器中走原生實作。
// ----------------------------------------------------------------------------

export function createBridgeClient({ baseUrl, fetchImpl, EventSourceImpl } = {}) {
  const f = fetchImpl ?? globalThis.fetch.bind(globalThis);
  const ES = EventSourceImpl ?? globalThis.EventSource;

  async function startTurn({ cli, stance, prompt, effortLevel }) {
    const res = await f(`${baseUrl}/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cli, stance, prompt, effortLevel }),
    });
    if (!res.ok) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch (_) { /* ignore */ }
      throw new Error(`POST /turn ${res.status}: ${bodyText}`);
    }
    const { turnId } = await res.json();
    return turnId;
  }

  function subscribe(turnId, { onChunk, onDone, onError }) {
    if (!ES) {
      onError && onError('EventSource unavailable in this environment');
      return { close: () => {} };
    }
    const es = new ES(`${baseUrl}/turn/${turnId}/stream`);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { es.close(); } catch (_) { /* ignore */ }
    };
    es.onmessage = (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch (_) { return; }
      if (typeof payload.chunk === 'string') {
        onChunk && onChunk(payload.chunk);
        return;
      }
      if (payload.done === true) {
        onDone && onDone();
        close();
        return;
      }
      if (typeof payload.error === 'string') {
        onError && onError(payload.error);
        close();
      }
    };
    es.onerror = () => {
      if (closed) return;
      onError && onError('SSE connection error');
      close();
    };
    return { close };
  }

  async function abortTurn(turnId) {
    try {
      await f(`${baseUrl}/turn/${turnId}/abort`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    } catch (_) {
      // best-effort
    }
  }

  return { startTurn, subscribe, abortTurn };
}
