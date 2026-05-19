<!--
全部 task 在 apply 階段已實作（per 「直接實作、後補文件」決策）。
本檔記錄正規 Spectra task 樹狀；驗證項目以已通過的 unit tests / 已操作的手動驗證為準。
-->

## 1. Exporter 模組

- [x] 1.1 建立 `src/exporter.js`（落實 design.md「`src/exporter.js` API」）並實作 Ended Screen Displays Export HTML Button 後端支援 + Export Filename Uses Debate Start Time — 匯出 `buildExportHtml(state, options?)`、`buildExportFilename(startedAtIso)`、`downloadExportHtml(state)` 三個函式，檔名格式 `debate-YYYYMMDD-HHMM.html` 由 `state.startedAt` 推導；驗證：`tests/exporter.test.js` 對 `buildExportFilename` 兩條斷言（合法 ISO 與不合法 fallback）皆通過、輸出均符合 `^debate-\d{8}-\d{4}\.html$` regex。
- [x] 1.2 實作 Exported HTML Is Single Self-Contained Document，對應 design.md「匯出檔嵌入完整 CSS 而非 fetch 線上樣式表」決策 — `EMBEDDED_CSS` 常數內嵌訊息卡 / chip / 失敗卡 / closing 雙線邊樣式，產出文件無外部 `<link>` / `<script>`；驗證：unit test 對 `buildExportHtml` 回傳字串斷言以 `<!doctype html>` 起始、含 `<style>`、無 `<link rel="stylesheet">`、無 `<script>`。
- [x] 1.3 實作 Exported HTML Contains Topic and Metadata Header — header `<h1>` 含 escape 後 topic、metadata 段含正方/反方 CLI、N、首發、推理、開始/結束時間、結束方式、失敗 turn 計數；驗證：unit test 對多種 endReason、N 與 CLI 組合分別斷言對應字串子集出現於文件。
- [x] 1.4 實作 Exported HTML Renders All Turns Including Failed Ones + Failed Turn 渲染對齊（落實 design.md「重用 `timeline.js` 的 DOM 渲染而非為匯出另寫渲染器」與「失敗 turn 在匯出檔仍渲染為 ⚠ 卡（不省略）」兩決策） — 透過 detached `<div>` 呼叫 `renderTimeline()` 序列化進匯出檔；失敗 turn 含 `turn-card--failed` class、warning marker、`errorMessage` 文字、stance/cli chip；驗證：unit test 對 6-turn 含 1 失敗的 state 斷言 6 個 `<article class="turn-card">`、失敗 turn 含對應 class 與 errorMessage 字串。
- [x] 1.5 實作 Closing Turns Marked Distinctly in Export — closing turn 的 chip 含「結辯」、卡片含 `turn-card--closing` class；驗證：unit test 對含 2 個 closing turn 的 state 斷言匯出文件含「結辯」字樣與 `turn-card--closing` class。
- [x] 1.6 實作 HTML Special Characters Are Escaped in Topic and Metadata，對應 design.md「HTML escape 在五個字元、不用 third-party library」 — `escapeHtml()` 手寫處理 `& < > " '` 五字元、無 third-party 依賴；驗證：unit test 對 `topic = "<script>alert(1)</script>"` 斷言匯出檔不含可執行 `<script>` 元素、含 `&lt;script&gt;` 字面值。

## 2. 結束畫面 UI 整合

- [x] 2.1 在 `app.js` 的 `renderEndedScreen` 實作 Clicking Export Triggers Browser Download，落實 design.md「`app.js` 流程改動」中的匯出按鈕段 — 結束畫面同時 append「重新開始」與「匯出 HTML」兩顆按鈕；匯出按鈕 click → `downloadExportHtml(state)` 觸發 Blob URL 下載並在下載派發後 `URL.revokeObjectURL`；驗證：手動跑完辯論進結束畫面、按下匯出鈕、瀏覽器下載清單出現 `.html` 檔。
- [x] 2.2 實作 Successful Export Updates DebateState.exported to True，對應 design.md「匯出後立即寫 `state.exported = true` 並 persist，按鈕回饋立刻更新」決策 — 匯出成功後 `state.exported = true` + `savePersistedState(state)`、按鈕文字更新為含「已匯出」或 filename；驗證：手動匯出後 DevTools Application → Local Storage 看 `spectra-debate:current.exported === true`；再次匯出仍正常觸發下載（re-export allowed）。

## 3. 重新開始確認對話框

- [x] 3.1 在 `app.js` 實作 `showConfirmRestartDialog(onProceed)` 函式，對應 design.md「確認對話框走自寫 overlay 而非 `window.confirm`」決策，落實 Confirmation Dialog Is Modal and Blocks Background Interaction — overlay class `confirm-overlay` 全螢幕半透明、dialog 含 3 顆按鈕（`data-confirm` 各為 `export-then-restart` / `restart-now` / `cancel`）；驗證：手動跑未匯出辯論結束、按重新開始、確認對話框出現且背景無法點擊；DevTools 看 `.confirm-overlay` z-index >= 100。
- [x] 3.2 實作 Restart Button Triggers Confirmation Dialog When Debate Is Not Yet Exported — 重新開始 click handler：若 `state.exported` 為 false 彈對話框、否則直接 `onRestart()`；驗證：手動匯出後再按重新開始 → 不彈對話框、直接進彈窗；未匯出按重新開始 → 彈對話框。
- [x] 3.3 實作 Cancel Option Leaves the Ended Screen Unchanged — 對話框 cancel 按鈕 click → 僅移除 overlay、不動 state 與 localStorage；驗證：手動測試 — 按取消後結束畫面照舊、Local Storage `spectra-debate:current` 未變、按鈕仍可再按。
- [x] 3.4 實作 Export-Then-Restart Option Performs Both Actions — 對話框「匯出後再開始」按鈕 → 先呼叫 `performExport()`、再呼叫 `onRestart()`；驗證：手動測試 — 按此選項後瀏覽器下載 .html 檔、隨後出現設定彈窗；Local Storage `current.exported` 寫入 true 再被新場覆寫。
- [x] 3.5 實作 Restart-Now Option Discards Unexported State Without Prompting Again — 「直接開始」按鈕 → 不匯出、直接 `onRestart()`；驗證：手動測試 — 按此選項後直接出現設定彈窗、無下載；下一場開始後舊 state 被覆寫。

## 4. CSS 與樣式整合

- [x] 4.1 在 `styles.css` 新增 `.confirm-overlay` / `.confirm-dialog` / `.confirm-dialog__actions` / `.confirm-dialog__btn` 樣式 — overlay 全螢幕半透明 + dialog 置中卡片 + 3 鈕垂直堆疊；驗證：手動測試對話框視覺、無遮罩漏邊、按鈕可清楚識別 primary / default / ghost。

## 5. 整合驗收

- [x] 5.1 跑完整 `npm test` 確認 12 條 exporter 測試與既有 147 條測試共 159 條全綠；驗證：`npm test` 輸出 `Tests 159 passed (159)`。
- [x] 5.2 對照 design.md「範圍邊界（避免 apply 漂移）」逐條 sanity check — In scope 5 項（exporter 模組、結束畫面整合、確認對話框、CSS、unit tests）已交付；Out of scope 5 項（多場歷史 UI、雲端同步、其他格式、預覽、互動 JS）在 codebase 內無痕跡；驗證：`grep` 新增檔案無 `pdf|markdown|json export|preview|cloud sync` 等字串。
