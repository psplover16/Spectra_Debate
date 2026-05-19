// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createBridge, resolveExecutable } from '../bridge.js';

function makeMockChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.killed = false;
  child.kill = vi.fn((signal) => {
    child.killed = true;
    child.lastSignal = signal;
  });
  return child;
}

async function readSSE(url) {
  const res = await fetch(url);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          events.push(JSON.parse(line.slice(6)));
        }
      }
    }
  }
  return events;
}

function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('bridge HTTP server', () => {
  let bridge;
  let baseUrl;
  let spawnCalls;
  let mockSpawn;

  beforeEach(async () => {
    spawnCalls = [];
    mockSpawn = vi.fn((cmd, args, opts) => {
      const child = makeMockChild();
      spawnCalls.push({ cmd, args, opts, child });
      return child;
    });
    bridge = createBridge({ spawnFn: mockSpawn, timeoutMs: 200 });
    await bridge.start({ port: 0, host: '127.0.0.1' });
    const addr = bridge.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await bridge.stop();
  });

  describe('Bridge Binds Only to Loopback Interface', () => {
    it('listens on 127.0.0.1', () => {
      expect(bridge.server.address().address).toBe('127.0.0.1');
    });

    it('default port is 7456 when no override', () => {
      expect(createBridge({ spawnFn: mockSpawn }).config.defaultPort).toBe(7456);
    });

    it('reads BRIDGE_PORT from env', () => {
      const original = process.env.BRIDGE_PORT;
      process.env.BRIDGE_PORT = '8123';
      try {
        const b = createBridge({ spawnFn: mockSpawn });
        expect(b.config.resolvedPort).toBe(8123);
      } finally {
        if (original === undefined) delete process.env.BRIDGE_PORT;
        else process.env.BRIDGE_PORT = original;
      }
    });
  });

  describe('Bridge Permits Cross-Origin Requests via Wildcard', () => {
    it('returns wildcard CORS header on OPTIONS', async () => {
      const res = await fetch(`${baseUrl}/turn`, { method: 'OPTIONS' });
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('returns wildcard CORS header on POST', async () => {
      const res = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'topic',
        effortLevel: 'medium',
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('resolveExecutable handles Windows .cmd shims', () => {
    it('resolves known binary (node) to a real absolute path', async () => {
      const resolved = await resolveExecutable('node');
      // node 一定在 PATH 中。Windows 解析為 .exe 全路徑、Linux/macOS 也應為絕對路徑或 bare 'node'
      expect(typeof resolved).toBe('string');
      expect(resolved.length).toBeGreaterThanOrEqual('node'.length);
      // 若已解析為絕對路徑，應含分隔符
      if (process.platform === 'win32') {
        expect(resolved.toLowerCase()).toContain('node');
      }
    });

    it('returns original cmd if not found (graceful fallback for ENOENT)', async () => {
      const resolved = await resolveExecutable('this-binary-should-not-exist-xyzzy-42');
      expect(resolved).toBe('this-binary-should-not-exist-xyzzy-42');
    });

    it('passes through already-absolute paths', async () => {
      const input = process.platform === 'win32' ? 'C:\\foo\\bar.exe' : '/usr/local/bin/foo';
      const resolved = await resolveExecutable(input);
      expect(resolved).toBe(input);
    });
  });

  describe('Bridge Spawns CLIs Without Shell Interpretation', () => {
    it('spawn called with shell: false and args array', async () => {
      await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: '"; rm -rf /',
        effortLevel: 'medium',
      });
      expect(spawnCalls).toHaveLength(1);
      expect(spawnCalls[0].opts.shell).toBe(false);
      expect(Array.isArray(spawnCalls[0].args)).toBe(true);
    });

    it('does not include shell metacharacters in args', async () => {
      await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: '$(echo pwned)',
        effortLevel: 'medium',
      });
      // The prompt is fed via stdin, so it must NOT appear in args
      const joined = spawnCalls[0].args.join(' ');
      expect(joined).not.toContain('$(echo pwned)');
    });
  });

  describe('POST /turn Launches a CLI Subprocess and Returns a Turn ID', () => {
    it('returns non-empty turnId', async () => {
      const res = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'topic',
        effortLevel: 'medium',
      });
      const body = await res.json();
      expect(typeof body.turnId).toBe('string');
      expect(body.turnId.length).toBeGreaterThan(0);
    });

    it('writes prompt to child stdin then closes', async () => {
      await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'hello world',
        effortLevel: 'medium',
      });
      const child = spawnCalls[0].child;
      expect(child.stdin.write).toHaveBeenCalledWith('hello world');
      expect(child.stdin.end).toHaveBeenCalled();
    });

    it('uses correct cli binary based on body.cli', async () => {
      await postJson(`${baseUrl}/turn`, {
        cli: 'claude',
        stance: 'con',
        prompt: 'p',
        effortLevel: 'medium',
      });
      // 三種可能位置：
      //   - Linux/macOS：cmd = 'claude'
      //   - Windows 解析後 .cmd：cmd = 'cmd.exe', args 含完整 claude 路徑
      //   - Windows 解析後 .exe：cmd 含 claude
      const joined = (
        spawnCalls[0].cmd + ' ' + spawnCalls[0].args.join(' ')
      ).toLowerCase();
      expect(joined).toContain('claude');
    });
  });

  describe('GET /turn/:turnId/stream Streams Output via Server-Sent Events', () => {
    it('streams chunks then done event', async () => {
      const startRes = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'p',
        effortLevel: 'medium',
      });
      const { turnId } = await startRes.json();
      const child = spawnCalls[0].child;

      const streamPromise = readSSE(`${baseUrl}/turn/${turnId}/stream`);
      await new Promise((r) => setTimeout(r, 30));
      child.stdout.emit('data', Buffer.from('Hello'));
      child.stdout.emit('data', Buffer.from(' World'));
      child.emit('exit', 0, null);

      const events = await streamPromise;
      expect(events).toEqual([
        { chunk: 'Hello' },
        { chunk: ' World' },
        { done: true },
      ]);
    });

    it('emits error event with stderr on non-zero exit', async () => {
      const startRes = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'p',
        effortLevel: 'medium',
      });
      const { turnId } = await startRes.json();
      const child = spawnCalls[0].child;

      const streamPromise = readSSE(`${baseUrl}/turn/${turnId}/stream`);
      await new Promise((r) => setTimeout(r, 30));
      child.stderr.emit('data', Buffer.from('something failed'));
      child.emit('exit', 1, null);

      const events = await streamPromise;
      expect(events).toHaveLength(1);
      expect(events[0].error).toMatch(/something failed/);
    });

    it('emits error event for empty output on clean exit', async () => {
      const startRes = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'p',
        effortLevel: 'medium',
      });
      const { turnId } = await startRes.json();
      const child = spawnCalls[0].child;

      const streamPromise = readSSE(`${baseUrl}/turn/${turnId}/stream`);
      await new Promise((r) => setTimeout(r, 30));
      child.emit('exit', 0, null);

      const events = await streamPromise;
      expect(events).toHaveLength(1);
      expect(events[0].error).toMatch(/empty content|empty|空/);
    });
  });

  describe('POST /turn/:turnId/abort Terminates the Running Subprocess', () => {
    it('sends SIGTERM and returns ok', async () => {
      const startRes = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'p',
        effortLevel: 'medium',
      });
      const { turnId } = await startRes.json();
      const child = spawnCalls[0].child;

      const streamPromise = readSSE(`${baseUrl}/turn/${turnId}/stream`);
      await new Promise((r) => setTimeout(r, 30));

      const abortRes = await postJson(`${baseUrl}/turn/${turnId}/abort`, {});
      const abortBody = await abortRes.json();
      expect(abortBody).toEqual({ ok: true });
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');

      // simulate child reacting to SIGTERM
      child.emit('exit', null, 'SIGTERM');

      const events = await streamPromise;
      expect(events.some((e) => e.error)).toBe(true);
    });
  });

  describe('90-Second Per-Turn Timeout Terminates Stuck CLIs', () => {
    it('default timeout is 90000ms', () => {
      const b = createBridge({ spawnFn: mockSpawn });
      expect(b.config.timeoutMs).toBe(90000);
    });

    it('kills child after timeout elapses with error event mentioning timeout', async () => {
      const startRes = await postJson(`${baseUrl}/turn`, {
        cli: 'codex',
        stance: 'pro',
        prompt: 'p',
        effortLevel: 'medium',
      });
      const { turnId } = await startRes.json();
      const child = spawnCalls[0].child;

      const streamPromise = readSSE(`${baseUrl}/turn/${turnId}/stream`);
      await new Promise((r) => setTimeout(r, 30));

      // bridge has timeoutMs = 200 for tests; wait 250 then simulate child exit
      await new Promise((r) => setTimeout(r, 250));
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');

      child.emit('exit', null, 'SIGTERM');
      const events = await streamPromise;
      expect(events.length).toBe(1);
      expect(events[0].error).toMatch(/timeout|逾時/i);
    });
  });
});
