## Context

`bootstrap-debate-mvp` 完成後，使用者擁有可跑完整辯論的網頁與本地 bridge、所有 turn 自動寫進 localStorage。但 localStorage 是**單一 slot 設計**：開新辯論會直接覆寫舊紀錄，無歷史 UI。早先 `_private/discuss.txt` Q7 系列討論已決議用「匯出 HTML 檔」承擔長期歸檔角色（替代多場歷史 UI 的 over-engineering）。

本變更補上：
- 結束畫面的匯出按鈕 + 完整 HTML 產生器
- 未匯出時的「重新開始」確認對話框（防誤觸資料遺失）
- `DebateState.exported` 旗標的維護流程

實作已先行（per 使用者「直接實作、後補文件」決策），本 design 為事後形式化文件。

## Goals / Non-Goals

**Goals:**

- 使用者**離開瀏覽器後**仍能查看歷史辯論（透過下載的 .html 雙擊離線開）
- 匯出檔視覺與線上時間軸**完全一致**（同樣的訊息卡、立場色、chip 標頭、失敗 ⚠ 卡）
- 防止「重新開始」誤觸導致未匯出的紀錄遺失
- 不擴大架構：仍是純前端 + 同一個 bridge、不新增伺服器端、不引入持久化資料庫

**Non-Goals:**

- 多場辯論歷史 UI（用匯出檔承擔）
- 雲端同步、跨裝置匯出
- 匯出 PDF / Markdown / JSON（HTML 是唯一格式）
- 預覽匯出畫面（按下即下載、不開新分頁預覽）
- 匯出檔內含 JS / 互動功能（純靜態）
- 中文檔名（仍用 `debate-YYYYMMDD-HHMM.html`、保持跨平台一致）

## Decisions

### 匯出檔嵌入完整 CSS 而非 fetch 線上樣式表

**選擇**：`src/exporter.js` 內以字串常數定義 `EMBEDDED_CSS`，產出時直接 inline 進匯出 HTML 的 `<style>` 區塊。

**替代方案**：
- *fetch `./styles.css` 後 inline*：理論上單一 CSS 來源、無重複。代價：`file://` 開啟頁面時 `fetch` 通常被 CORS 擋；瀏覽器跑此程式碼時行為不可預期，匯出可能失敗。
- *將 `styles.css` 整檔內嵌至 JS（build step）*：需要 bundler，違反「無 build step」設計。

**理由**：MVP 場景下訊息卡相關樣式僅需 ~20 條 CSS rule，嵌入字串維護成本低；自治、無 fetch 依賴、`file://` 開啟也能用；視覺一致性由「test：匯出 HTML 與線上時間軸顯示等價」守住。

### 重用 `timeline.js` 的 DOM 渲染而非為匯出另寫渲染器

**選擇**：`buildExportHtml(state)` 內建立 detached `<div>`、呼叫現有的 `renderTimeline(div, state.turns)`、序列化為字串塞入匯出 HTML。

**替代方案**：為匯出寫一支獨立的 string-based renderer。

**理由**：避免雙重維護 — 任何 chip / 失敗卡 / 結辯標記的視覺調整自動傳遞到匯出檔；測試規模也減半。代價是匯出器強依賴 DOM（瀏覽器 + JSDOM 都有，所以實際無痛）。

### 確認對話框走自寫 overlay 而非 `window.confirm`

**選擇**：`showConfirmRestartDialog(onProceed)` 在 `<body>` 注入半透明 overlay + 3 鈕對話框。

**替代方案**：用 native `window.confirm` 提示「要先匯出嗎？」。

**理由**：`window.confirm` 只能回 2 鈕（確定 / 取消）；本案需 **3 個選項**（匯出後再開始 / 直接開始 / 取消），無法用 native。另外 native dialog 視覺與專案不一致。

### 匯出後立即寫 `state.exported = true` 並 persist，按鈕回饋立刻更新

**選擇**：點下匯出按鈕 → `downloadExportHtml(state)` → 成功後 `state.exported = true` → `savePersistedState(state)` → 更新按鈕文字為 `✓ 已匯出 <filename>（再匯一次）`。

**替代方案**：純記憶體標記（不寫回 localStorage）— 重新整理會丟失「已匯出」狀態、誤觸發確認對話框。

**理由**：與 design.md「localStorage Schema」一致；重新整理頁面仍能正確判斷已匯出狀態、避免使用者抱怨「明明剛剛已經匯出」。

### 失敗 turn 在匯出檔仍渲染為 ⚠ 卡（不省略）

**選擇**：失敗 turn 一律渲染為灰底 ⚠ 卡片，含 `errorMessage`。

**替代方案**：匯出時自動跳過失敗 turn 讓檔案更乾淨。

**理由**：使用者可能想留下「對方該 turn 失敗」的證據（影響辯論結果）；保留也對應 `debate-message-timeline` spec 既有「Failed Turns Render as Distinct Warning Cards」契約、線上線下一致。

### HTML escape 在五個字元、不用 third-party library

**選擇**：手寫 `escapeHtml()` 處理 `& < > " '`。

**替代方案**：引入 `lodash.escape` 或 `he` package。

**理由**：依賴新增不划算 — 此處 escape 範圍清楚、attack surface 受限（只在 metadata + textContent），手寫一段 6 行函式可審計、可測試。

## Implementation Contract

### `src/exporter.js` API

**`buildExportHtml(state, options?) → string`**
- 輸入：完整 `DebateState`（含 `turns[]`、`startedAt`、`endedAt`、`endReason`、`exported` 等）；`options.exportedAt` 為可選 ISO 字串（預設 `new Date().toISOString()`）；`options.doc` 可選 `Document`（預設 `globalThis.document`，便於測試）。
- 輸出：完整 HTML 字串、以 `<!doctype html>` 開頭。
- 內含：`<title>{topic} — 辯論紀錄</title>`、`<style>{內嵌 CSS}</style>`、header（h1 + metadata）、`.timeline` 區塊（重用 `renderTimeline`）、footer（匯出時間）。
- 失敗模式：若無 `document` 可用，throw `Error('document is required to build export HTML (run in browser or jsdom)')`。

**`buildExportFilename(startedAtIso) → string`**
- 輸入：ISO 8601 時間字串。
- 輸出：`debate-YYYYMMDD-HHMM.html`（依本地時區）。
- 失敗模式：無效輸入 fallback 為當前時間，仍回有效格式檔名。

**`downloadExportHtml(state) → string`**
- 副作用：以 `Blob` + `URL.createObjectURL` + `<a download>` 觸發瀏覽器下載；下載完成後 `setTimeout(() => URL.revokeObjectURL(...), 0)` 釋放。
- 回傳：實際使用的檔名（給 UI 顯示）。

### `app.js` 流程改動

**`renderEndedScreen(state, { onRestart })`** 新增：

1. 「匯出 HTML」按鈕 — 顯示文字依 `state.exported` 切換：未匯出 `"匯出 HTML"`、已匯出 `"✓ 已匯出 HTML（再匯一次）"` 或 `"✓ 已匯出 <filename>（再匯一次）"`。
2. 內部 `performExport()` 函式：呼叫 `downloadExportHtml(state)` → 成功則設 `state.exported = true` + `savePersistedState(state)` + 更新按鈕文字；失敗 alert error message。
3. 「重新開始」按鈕 click handler 改寫：若 `state.exported` 已 true 直接 `onRestart()`；否則 `showConfirmRestartDialog((action) => {...})`，依使用者選擇分流。

**`showConfirmRestartDialog(onProceed)`** — 新函式：

1. 在 `document.body` append 全螢幕 overlay（class `confirm-overlay`）。
2. Overlay 內含對話框（class `confirm-dialog`），3 顆按鈕，`data-confirm` 分別為 `export-then-restart` / `restart-now` / `cancel`。
3. 任一按鈕 click → 移除 overlay + 呼叫 `onProceed(action)`。
4. `action === 'cancel'` 時不做任何事；`action === 'export-then-restart'` 時先呼叫 `performExport()` 再 `onRestart()`；`restart-now` 直接 `onRestart()`。

### 驗收

實作完成時應可：

- `npm test` 通過、包含 12 條新增的 `tests/exporter.test.js`
- 跑完一場辯論進入結束畫面、看到「重新開始」與「匯出 HTML」兩顆按鈕
- 點「匯出 HTML」→ 瀏覽器立即下載 `debate-YYYYMMDD-HHMM.html`、按鈕文字變為 `✓ 已匯出 ...`
- 雙擊下載的 HTML → 看到完整辯題標題、metadata 段、訊息卡時間軸（與線上樣式一致）
- 已匯出狀態下點「重新開始」→ **不**彈確認對話框、直接進彈窗
- 未匯出狀態下點「重新開始」→ 彈 3 鈕確認對話框
- 重新整理頁面 → `state.exported` 從 localStorage 正確還原，再次點「重新開始」維持上述行為

### 範圍邊界（避免 apply 漂移）

**In scope**：`src/exporter.js`、`app.js` 結束畫面與重新開始流程、`styles.css` 對話框樣式、12 條 unit tests、兩個新 capability spec。

**Out of scope**：
- 多場歷史 UI / 第二個 localStorage slot
- 雲端同步、上傳 API
- 匯出 PDF / Markdown / JSON
- 鍵盤導航與焦點管理（a11y v2）
- 匯出檔內含互動 JS

## Risks / Trade-offs

- **`EMBEDDED_CSS` 與 `styles.css` 內容重複** → 若線上樣式大改、匯出檔可能視覺漂移。Mitigation：使用 visual smoke 測試（手動），且匯出 CSS 僅涵蓋 timeline 必要 rule（不含 popup / header 等不出現於匯出檔的元素）。
- **`window.confirm` vs 自訂 overlay** → 自訂 overlay 若 z-index 衝突可能被遮蓋。Mitigation：z-index 100 高於所有現有樣式。
- **未匯出對話框可能被使用者覺得煩** → 已匯出後不再彈、且有「直接開始」逃生口。Mitigation：UX 文案保持中性、不強制。
- **Blob URL 釋放時機** → `setTimeout(..., 0)` revoke 給瀏覽器寫盤時間。極端情況可能太早 revoke。Mitigation：瀏覽器實作多半已將 Blob 內容 copy 到下載佇列，revoke 後仍可下載；若回報失敗可延長 timeout。
- **HTML escape 漏邊角** → 五字元覆蓋常見 XSS 向量；若 textContent 含罕見 control char 仍應 escape。Mitigation：實際內容來自 CLI stdout、`textContent` 設值會自動 escape；exporter 只在組 metadata 時手動 escape、攻擊面很窄。
