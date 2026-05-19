## Why

本專案為綠地（greenfield）AI 辯論觀賞型網頁，目前 `openspec/` 之外無任何源碼。要讓使用者輸入辯題後讓兩個本地 CLI（codexCli、claudeCli）輪流辯論，必須面對「瀏覽器 sandbox 不能 spawn 本地進程」的物理限制 — 因此本變更承認需要本地 Node bridge，並一次建立完整可跑的辯論流程骨架（彈窗 → 自動推進 → 終止 → 結束畫面）。匯出 HTML 與「重新開始」未匯出提示對話框由後續變更承接，本次刻意排除。

## What Changes

- **新增本地 Node bridge（`bridge.js`）**：監聽 127.0.0.1 + CORS allowall（最寬鬆、單機定位）；POST `/turn` 啟動 CLI 子程序、GET `/turn/:id/stream` 經 SSE 串流 stdout、POST `/turn/:id/abort` 終止當前 CLI。CLI 呼叫強制 `spawn(..., { shell: false })` 以阻擋命令注入。
- **新增辯論設定彈窗**：5 欄位（辯題 4~100 字、哪個 CLI 當正方、每方發言次數 N=2~5 預設 3、誰先發言、推理能力 5 級）；確定按鈕需全欄通過校驗才 enabled；上次輸入存 localStorage `lastFormValues` 並下次自動帶入。
- **新增回合狀態機**：自動推進（CLI 完成觸發內部「下一回合」event）+「終止」UI 按鈕為唯一使用者流程控制（語意為永久結束、不可恢復）+ CLI 失敗 / 逾時 90 秒處理（標註失敗、跳過該回合、不重試、不終場）+ 主辯 vs 結辯切換（最後 2 個 turn 為結辯）。
- **新增時間軸 UI**：訊息卡上下時間軸排列；chip 標頭如 `[正方 · codex]` 置左上、時間戳於右上、內文獨立段落；正方藍色系、反方紅色系；CLI 回應串流逐字顯示（瀏覽器 EventSource 接 SSE）；失敗 turn 渲染為灰底 ⚠ 卡片。
- **新增 prompt 脈絡管理**：每回合 bridge.js 依當前辯論狀態完整重塞辯論歷史（第 1 turn 到上一 turn 所有發言、含失敗紀錄）；主辯 prompt 強調「扣緊辯題 + 直接回應對手 + 不自相矛盾」；結辯 prompt 切版本強調「總結 + 反駁、不開新戰線」。
- **新增 effort 翻譯層**：bridge.js 維護 codex 與 claude 兩張獨立翻譯表（已確認 claude 第 4 級拼字為 `xigh` 不含 h、codex 第 5 級為 `xhigh` 含 h），UI 5 級採名稱對齊策略；codex 的 `minimal` 不暴露給 UI、UI「max」對 codex 封頂為 `xhigh`；需以 unit test 斷言 `xigh` / `xhigh` 字面值避免維護時被自動修正。
- **新增 localStorage 持久化**：當前辯論 `DebateState` 完整存 `spectra-debate:current`；每個 turn 結束（含失敗）寫入一次、不在串流逐字時寫；重新整理頁面後若 `endedAt` 存在直接顯示結束畫面，若 `turns` 非空但無 `endedAt` 視為中斷不自動續跑（避免重整觸發 CLI 重啟）。
- **資料結構強制雙欄位**：`Turn` 結構同時保存 `cli` 與 `stance` 兩欄位、互不 derive；雖 MVP 場中角色固定不互換，仍為未來互換情境預留 schema（呼應 `openspec/config.yaml` 既有規則）。
- **同步修正 `openspec/config.yaml`**：將「純前端 + 本地 CLI、無後端、無資料庫」修正為「前端 UI + 本地 Node bridge（單機執行）」，使後續變更與 config 對話時不再陷入矛盾。

## Non-Goals

- 匯出 HTML 功能 — 由後續變更 `add-debate-export-and-restart-guard` 承接
- 「重新開始」按鈕的未匯出提示對話框 — 同上
- 跨網站防護（CSRF / origin token / 一次性 token）— 採最寬鬆策略、註明風險、留 v2
- CLI 失敗時的自動重試
- 立場中途互換的 UI 與流程（僅保留資料層欄位）
- 判定者 turn / 第三 CLI 仲裁
- codex 與 claude 各自獨立的推理能力設定（UI 共用單一控制）
- 訊息卡上顯示推理等級
- 交棒視覺 indicator
- 暫停 / 繼續流程控制
- 「下一回合」UI 按鈕（為內部 event、不暴露給使用者）
- 滾動視窗 / 歷史摘要（場景上下文長度可承受完整重塞）
- Tauri / Electron 桌面殼層
- 使用者帳號 / 多場辯論歷史
- 後端伺服器 / 雲端同步

## Capabilities

### New Capabilities

- `debate-setup`: 辯論設定彈窗 — 5 欄位輸入、校驗、預設值持久化、確定後啟動辯論
- `debate-host-bridge`: 本地 Node bridge — HTTP API、SSE 串流、CLI spawn 安全寫法、effort 翻譯層
- `debate-flow-control`: 回合狀態機 — 自動推進、終止、CLI 失敗跳過、主辯 / 結辯切換
- `debate-message-timeline`: 訊息時間軸 UI — chip 標頭、立場色系、串流逐字渲染、失敗訊息卡
- `debate-prompt-context`: 辯論歷史脈絡管理與 prompt template — 主辯版 / 結辯版、完整重塞策略
- `debate-persistence`: localStorage 持久化 — DebateState / lastFormValues schema、寫入時機、載入恢復策略

### Modified Capabilities

(無 — 綠地專案，所有 capability 皆為新建)

## Impact

- Affected specs: 上述 6 個 New Capabilities 對應新建 `openspec/specs/debate-setup/spec.md`、`openspec/specs/debate-host-bridge/spec.md`、`openspec/specs/debate-flow-control/spec.md`、`openspec/specs/debate-message-timeline/spec.md`、`openspec/specs/debate-prompt-context/spec.md`、`openspec/specs/debate-persistence/spec.md`
- Affected code:
  - New:
    - `index.html`：前端入口頁
    - `app.js`：前端主程式（狀態機、時間軸渲染、彈窗邏輯、SSE 接收、localStorage 存取）
    - `styles.css`：訊息卡、chip、時間軸、彈窗樣式
    - `bridge.js`：本地 Node host bridge（HTTP API、CLI spawn、effort 翻譯）
    - `package.json`：Node 版本與相依宣告
  - Modified:
    - `openspec/config.yaml`：架構描述修正（純前端 + 本地 CLI → 前端 UI + 本地 Node bridge）
  - Removed: 無
