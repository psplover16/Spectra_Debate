# Spectra-Debate

AI 雙人辯論觀賞型網頁。使用者輸入辯題、指定 codex 與 claude 兩個本地 CLI 誰當正方／反方，瀏覽器內看兩個 CLI 輪流辯論（自動串流逐字、共 8 turn 預設、含結辯）。

## 架構

- **前端**：`index.html` + `app.js` + `styles.css`（純 ES module、無 build step）
- **本地 Node bridge**：`bridge.js`（監聽 `127.0.0.1:7456`，作為瀏覽器 ↔ codex/claude CLI 中介）
- **核心模組**：`src/`（effort 翻譯、prompt builder、turn plan、state machine、setup popup、timeline 渲染、persistence）
- **狀態保存**：localStorage（單一 slot：`spectra-debate:current` + `spectra-debate:lastFormValues`）

詳見 `openspec/changes/bootstrap-debate-mvp/design.md`。

## 前置需求

- Node.js ≥ 18
- 本機已安裝 `codex` 與 `claude` CLI、且 `PATH` 內可直接執行（Windows 上 npm 全域 shim `.cmd` 亦支援、bridge 會自動透過 `cmd.exe /c` 啟動，並仍維持 `shell: false`）
- claude 支援 `--print` + `--effort <level>` 非互動模式（level: low/medium/high/xhigh/max）
- codex 支援 `exec` 子命令 + `-c model_reasoning_effort=<level>` 設定（level: minimal/low/medium/high/xhigh）
- 若 CLI 旗標或 effort 值範圍與上述不同，到 `src/effort.js` 的 `buildCliInvocation()` 直接調整即可

## 安裝

```bash
npm install
```

## 啟動

開**兩個** terminal（或讓 bridge 在背景跑也可）：

```bash
# Terminal 1: 啟動本地 bridge（保持開啟）
npm start
# → Listening on http://127.0.0.1:7456
```

```bash
# Terminal 2（可選）：跑單元測試
npm test
```

接著開瀏覽器，**任一方式**即可：

- 直接雙擊 `index.html`（透過 `file://` 開啟）
- 或開瀏覽器到 `http://127.0.0.1:7456/`（bridge 同時服務靜態檔）

兩種方式皆可正常運作。

## 自動化測試

```bash
npm test         # 一次性
npm run test:watch
```

目前涵蓋 11 個測試檔、共 146 個 tests（含 effort 翻譯 xigh/xhigh 字面值斷言、bridge HTTP API 端對端模擬、prompt builder、狀態機自動推進 + 終止 + 失敗跳過、persistence 路由、setup popup 校驗、timeline DOM 渲染）。

## 手動驗證 Checklist（對應 tasks 9.1 / 9.2 / 9.3）

下列三個情境涉及實際的 codex / claude CLI 子程序，需要在你的環境跑過、貼截圖／log 進 PR。

### 9.1 完整辯論一場（happy path）

1. `npm start`（bridge log 顯示 `Listening on http://127.0.0.1:7456`）
2. 開瀏覽器到 `http://127.0.0.1:7456/`（或雙擊 `index.html`）
3. 在彈窗輸入：辯題（4~100 字）、正方=codex、N=3、首發=正方、推理=中
4. 點「開始辯論」
5. 確認觀察到：
   - 訊息卡逐張出現、CLI 回應**逐字串流**
   - 正方藍色系、反方紅色系；chip 標頭含 `正方 · codex` / `反方 · claude`
   - 共跑 8 turn（前 6 主辯交替、後 2 結辯）
   - 結束後出現「重新開始」按鈕
6. DevTools Console：無未捕捉錯誤
7. DevTools Application → Local Storage：`spectra-debate:current` 內 `endedAt` 存在、`endReason: "completed"`、`turns.length === 8`

### 9.2 使用者終止 + 重新整理保留現場

1. 開始一場辯論（同上）
2. 跑到第 2 turn 時點「終止」
3. 確認：立即進入結束畫面、最後 turn 標為失敗（`使用者終止`）
4. 重新整理頁面
5. 確認：
   - 仍顯示**結束畫面**（不自動續跑 — 對應 design.md「載入時不自動續跑而是顯示結束畫面」）
   - 若 `endedAt` 存在 → 顯示「辯論已由使用者終止」
   - 若中斷（極端情況：終止前狀態尚未寫入）→ 顯示「⚠ 上次未完成」中斷標記
6. DevTools Network：重整後**沒有**對 `127.0.0.1:7456` 的請求

### 9.3 CLI 失敗跳過

1. 暫時讓某個 CLI 失效（例如 `mv $(which codex) $(which codex).bak`）
2. 啟動辯論
3. 確認：
   - 失敗的 turn 顯示為**灰底 ⚠ 卡片**，含 `errorMessage`（例如 `Failed to start CLI: ...` 或 `CLI exited with code ...`）
   - 對手 turn **照常啟動**、不終場
   - 整場結束畫面顯示「失敗 X turn」統計
4. 恢復 CLI 後再跑一場應一切正常

## 已知限制（明確不在 MVP 範圍內）

- **匯出 HTML** — 由後續變更 `add-debate-export-and-restart-guard` 承接
- **未匯出提示對話框**（重新開始前）— 同上
- **跨網站防護**（CSRF / origin token）— 採最寬鬆策略，**單機定位**；勿在共享機器執行
- **CLI 失敗自動重試** — 失敗即標註、不重試
- **立場中途互換 UI** — 僅保留資料層欄位（每筆 `turn` 同時存 `cli` 與 `stance`）
- **第三方判定者 / 仲裁**
- **多場辯論歷史** — localStorage 只保留當前一場
- **後端伺服器、使用者帳號、雲端同步**
- **Tauri / Electron 桌面打包**

## 故障排除

- **`Listening on ...` 沒出現** — 7456 port 被佔用，設環境變數覆寫：`BRIDGE_PORT=8000 npm start`
- **瀏覽器 console 顯示 CORS 錯誤** — 確認 bridge 已啟動、URL 為 `http://127.0.0.1` 或 `file://`
- **`Failed to start CLI: spawn <cli> ENOENT`** — 對應 CLI 未安裝或不在 `PATH`，先在 terminal 跑 `codex --help` / `claude --help` 確認；Windows 上 bridge 會自動解析 `.cmd` shim，不需手動處理
- **`unknown option '--reasoning-effort'` 或 `unknown flag`** — CLI 旗標名稱與 `src/effort.js` 的 `buildCliInvocation()` 預設不同，直接編輯該函式
- **`The '<model>' model requires a newer version of Codex`** — codex 本身需更新，跑 `npm install -g @openai/codex@latest`（或 `codex update`）；或在 `src/effort.js` 的 codex 段加上 `-c model=<較舊模型>` flag
- **bridge log 中文顯示亂碼** — Windows PowerShell 預設 console code page 非 UTF-8。bridge 會嘗試自動 `chcp 65001`（cmd.exe）；若仍亂碼可在啟動前手動執行 `chcp 65001` 或將 PowerShell 設為 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`。讀取 redirect 後的 log 檔請用 `Get-Content -Encoding UTF8`
