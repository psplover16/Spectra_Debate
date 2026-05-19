// Spectra-Debate local Node bridge
// ----------------------------------------------------------------------------
// 瀏覽器 ↔ codex/claude CLI 的本地中介。安全層：
//   - 僅綁 127.0.0.1（外部裝置無法連線）
//   - CORS allowall（單機定位、非範圍：跨網站 CSRF 防護）
//   - spawn shell:false（杜絕命令注入）
//   - 90 秒 per-turn timeout
//   - body 大小上限 100KB
//
// HTTP API（見 openspec/changes/bootstrap-debate-mvp/design.md「bridge.js HTTP API」）：
//   POST /turn               -> { turnId }
//   GET  /turn/:id/stream    -> SSE: chunk × N → done | error
//   POST /turn/:id/abort     -> { ok: true }
// ----------------------------------------------------------------------------

import { createServer } from 'node:http';
import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep, posix, delimiter } from 'node:path';
import { execSync } from 'node:child_process';
import { buildCliInvocation, EFFORT_LEVELS } from './src/effort.js';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));

// 靜態檔案白名單 — 嚴限可服務的路徑，避免路徑穿越
const STATIC_FILES = new Map([
  ['/', { rel: 'index.html', mime: 'text/html; charset=utf-8' }],
  ['/index.html', { rel: 'index.html', mime: 'text/html; charset=utf-8' }],
  ['/app.js', { rel: 'app.js', mime: 'application/javascript; charset=utf-8' }],
  ['/styles.css', { rel: 'styles.css', mime: 'text/css; charset=utf-8' }],
]);

function isAllowedSrcModule(pathname) {
  // 只允許 /src/<檔名>.js 形式，不含路徑穿越
  if (!pathname.startsWith('/src/')) return false;
  if (pathname.includes('..')) return false;
  if (!pathname.endsWith('.js')) return false;
  const rest = pathname.slice('/src/'.length);
  // 不允許再嵌套 /
  if (rest.includes('/')) return false;
  return true;
}

// Windows: npm-global CLI 多半是 .cmd shim。`spawn(..., { shell: false })` 不會
// 自動嘗試 PATHEXT 擴展名，必須手動解析絕對路徑。Linux / macOS 此函式直接回傳原名。
// Windows 不嘗試「裸名」— 因為 Windows shell 只能執行 PATHEXT 列出的副檔名，
// 裸名（如 npm-global 的 bash shim）即使存在也 spawn 不起來。
export async function resolveExecutable(cmd) {
  if (cmd.includes('/') || cmd.includes('\\')) return cmd;
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const isWindows = process.platform === 'win32';
  const exts = isWindows
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, cmd + ext);
      try {
        const s = await stat(candidate);
        if (s.isFile()) return candidate;
      } catch (_) {
        // try next
      }
    }
  }
  return cmd; // fallback — let spawn fail with original error
}

async function serveStatic(req, res, pathname) {
  let rel;
  let mime;
  const meta = STATIC_FILES.get(pathname);
  if (meta) {
    rel = meta.rel;
    mime = meta.mime;
  } else if (isAllowedSrcModule(pathname)) {
    rel = posix.join('src', pathname.slice('/src/'.length));
    mime = 'application/javascript; charset=utf-8';
  } else {
    return false;
  }
  const absolute = resolve(PROJECT_ROOT, rel.split('/').join(sep));
  // double-check absolute is under PROJECT_ROOT
  if (!absolute.startsWith(PROJECT_ROOT + sep) && absolute !== PROJECT_ROOT) {
    return false;
  }
  try {
    const s = await stat(absolute);
    if (!s.isFile()) return false;
    const data = await readFile(absolute);
    res.writeHead(200, {
      'content-type': mime,
      'cache-control': 'no-cache',
      ...CORS_HEADERS,
    });
    res.end(data);
    return true;
  } catch (_) {
    return false;
  }
}

const STANCES = ['pro', 'con'];
const CLI_NAMES = ['codex', 'claude'];
const MAX_BODY_BYTES = 100 * 1024;
const DEFAULT_PORT = 7456;
const DEFAULT_TIMEOUT_MS = 90 * 1000;

const CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
});

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (err) {
        reject(Object.assign(new Error('invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function validateTurnRequest(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('body must be an object');
  else {
    if (!CLI_NAMES.includes(body.cli)) errors.push(`cli must be one of ${CLI_NAMES.join('/')}`);
    if (!STANCES.includes(body.stance)) errors.push(`stance must be one of ${STANCES.join('/')}`);
    if (typeof body.prompt !== 'string' || body.prompt.length === 0)
      errors.push('prompt must be a non-empty string');
    if (!EFFORT_LEVELS.includes(body.effortLevel))
      errors.push(`effortLevel must be one of ${EFFORT_LEVELS.join('/')}`);
  }
  return errors;
}

function writeSSE(res, payload) {
  // 標準 SSE 訊框：每則訊息以「data: <json>\n\n」表示
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createBridge(options = {}) {
  const spawnFn = options.spawnFn ?? nodeSpawn;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const envPort = process.env.BRIDGE_PORT
    ? Number.parseInt(process.env.BRIDGE_PORT, 10)
    : undefined;
  const resolvedPort = Number.isFinite(envPort) ? envPort : DEFAULT_PORT;

  /** @type {Map<string, TurnState>} */
  const turns = new Map();

  function emitToTurn(turn, payload) {
    if (turn.ended) return;
    const isTerminal = 'done' in payload || 'error' in payload;
    if (isTerminal) {
      turn.ended = true;
      if (turn.timeoutHandle) clearTimeout(turn.timeoutHandle);
    }
    if (turn.sseRes && !turn.sseRes.writableEnded) {
      writeSSE(turn.sseRes, payload);
      if (isTerminal) turn.sseRes.end();
    } else {
      turn.buffered.push(payload);
    }
  }

  async function startTurn(body) {
    const turnId = randomUUID();
    // CLI 啟動 args — prompt 一律走 stdin、不入 args，避免任何命令注入面向
    const userlessArgs = buildCliInvocation(body.cli, body.effortLevel);
    // Windows 解析 .cmd / .exe 真實路徑，避免 spawn ENOENT
    const resolvedCmd = await resolveExecutable(body.cli);

    // Node 18.20.2+ 因應 CVE-2024-27980 禁止直接 spawn .cmd / .bat。我們不開
    // shell:true（否則 args 會經 shell 解析、injection 面向回來），而是明確
    // 走 cmd.exe /c <full-path> <args> — 所有 args 都由本程式控制、無使用者
    // 輸入混入（prompt 走 stdin），安全性等同直接 spawn。
    let spawnCmd = resolvedCmd;
    let spawnArgs = userlessArgs;
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedCmd)) {
      spawnCmd = 'cmd.exe';
      spawnArgs = ['/c', resolvedCmd, ...userlessArgs];
    }

    const child = spawnFn(spawnCmd, spawnArgs, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    /** @typedef {Object} TurnState
     *  @property {ReturnType<typeof nodeSpawn>} child
     *  @property {object[]} buffered
     *  @property {import('node:http').ServerResponse | null} sseRes
     *  @property {boolean} ended
     *  @property {boolean} hasOutput
     *  @property {string} stderrBuf
     *  @property {NodeJS.Timeout | null} timeoutHandle
     */
    /** @type {TurnState} */
    const turn = {
      child,
      buffered: [],
      sseRes: null,
      ended: false,
      hasOutput: false,
      stderrBuf: '',
      timeoutHandle: null,
    };
    turns.set(turnId, turn);

    child.stdout.on('data', (data) => {
      const text = data.toString('utf8');
      if (text.length === 0) return;
      turn.hasOutput = true;
      emitToTurn(turn, { chunk: text });
    });
    child.stderr.on('data', (data) => {
      turn.stderrBuf += data.toString('utf8');
    });
    child.on('exit', (code, signal) => {
      if (turn.ended) return;
      if (signal === 'SIGTERM') {
        emitToTurn(turn, { error: 'CLI terminated (SIGTERM)' });
      } else if (typeof code === 'number' && code !== 0) {
        const snippet = turn.stderrBuf.slice(0, 200).trim() || `exit code ${code}`;
        emitToTurn(turn, { error: `CLI exited with code ${code}: ${snippet}` });
      } else if (!turn.hasOutput) {
        emitToTurn(turn, { error: 'CLI returned empty content' });
      } else {
        emitToTurn(turn, { done: true });
      }
    });
    child.on('error', (err) => {
      if (turn.ended) return;
      emitToTurn(turn, { error: `Failed to start CLI: ${err.message}` });
    });

    // prompt via stdin（永遠不走 args，避免命令注入面向）
    if (child.stdin) {
      child.stdin.write(body.prompt);
      child.stdin.end();
    }

    turn.timeoutHandle = setTimeout(() => {
      if (turn.ended) return;
      try {
        child.kill('SIGTERM');
      } catch (_) {
        /* child may already be dead */
      }
      emitToTurn(turn, { error: `CLI timeout (${Math.round(timeoutMs / 1000)} seconds elapsed without completion)` });
    }, timeoutMs);

    return turnId;
  }

  function attachStream(req, res, turnId) {
    const turn = turns.get(turnId);
    if (!turn) {
      jsonResponse(res, 404, { error: 'turn not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      ...CORS_HEADERS,
    });
    // flush buffered
    for (const ev of turn.buffered) writeSSE(res, ev);
    const wasEnded = turn.ended;
    turn.buffered = [];
    if (wasEnded) {
      res.end();
      return;
    }
    turn.sseRes = res;
    req.on('close', () => {
      if (turn.sseRes === res) turn.sseRes = null;
    });
  }

  function abortTurn(turnId) {
    const turn = turns.get(turnId);
    if (turn && !turn.ended) {
      try {
        turn.child.kill('SIGTERM');
      } catch (_) {
        /* already dead */
      }
      // 不在此 emit error — child exit handler 會以 SIGTERM signal 路徑 emit
    }
    return { ok: true };
  }

  async function handle(req, res) {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

      if (method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (method === 'POST' && url.pathname === '/turn') {
        const body = await readBody(req);
        const errs = validateTurnRequest(body);
        if (errs.length > 0) {
          jsonResponse(res, 400, { error: errs.join('; ') });
          return;
        }
        const turnId = await startTurn(body);
        jsonResponse(res, 200, { turnId });
        return;
      }

      const streamMatch = method === 'GET' && url.pathname.match(/^\/turn\/([^/]+)\/stream$/);
      if (streamMatch) {
        attachStream(req, res, streamMatch[1]);
        return;
      }

      const abortMatch = method === 'POST' && url.pathname.match(/^\/turn\/([^/]+)\/abort$/);
      if (abortMatch) {
        // 讀掉 body（即使空）以正確處理 keep-alive
        await readBody(req).catch(() => {});
        jsonResponse(res, 200, abortTurn(abortMatch[1]));
        return;
      }

      // 靜態檔案服務（讓 http://127.0.0.1:7456/ 也能開）
      if (method === 'GET') {
        const served = await serveStatic(req, res, url.pathname);
        if (served) return;
      }

      jsonResponse(res, 404, { error: 'not found' });
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      jsonResponse(res, status, { error: err && err.message ? err.message : 'internal error' });
    }
  }

  const server = createServer(handle);

  return {
    server,
    config: {
      defaultPort: DEFAULT_PORT,
      resolvedPort,
      timeoutMs,
    },
    async start({ port = resolvedPort, host = '127.0.0.1' } = {}) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
    },
    async stop() {
      // 先 kill 殘留 children
      for (const turn of turns.values()) {
        if (!turn.ended) {
          try {
            turn.child.kill('SIGTERM');
          } catch (_) {
            /* ignore */
          }
          if (turn.timeoutHandle) clearTimeout(turn.timeoutHandle);
        }
      }
      turns.clear();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

// 當作為 `node bridge.js` 直接執行時，自動 start
const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  // Windows console 預設 code page (cp950 / cp437) 無法顯示中文 UTF-8 bytes，
  // 切到 UTF-8（cp 65001）讓本地 log 可讀。失敗則靜默 fallback。
  if (process.platform === 'win32') {
    try {
      execSync('chcp 65001 > nul', { stdio: ['ignore', 'ignore', 'ignore'], shell: true });
    } catch (_) {
      /* 無權限或環境不支援，忽略 */
    }
  }
  const bridge = createBridge();
  bridge
    .start()
    .then(() => {
      const port = bridge.server.address().port;
      console.log(`Listening on http://127.0.0.1:${port}`);
      console.log('請保持此 terminal 開啟、不要關閉。');
    })
    .catch((err) => {
      console.error('Bridge failed to start:', err);
      process.exit(1);
    });
}
