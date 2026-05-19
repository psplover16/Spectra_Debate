## Why

`bootstrap-debate-mvp` 提供完整辯論流程但**沒有長期歸檔機制** — localStorage 只能存「當前一場」，使用者按「重新開始」就會覆寫掉前一場的紀錄。`_private/discuss.txt`（Q7 系列討論）明確要求結束畫面要能匯出整場辯論為 self-contained HTML，雙擊離線就能看。此外、為了避免使用者誤按「重新開始」失去尚未匯出的紀錄，需要一個未匯出確認對話框。本變更補上這兩塊。

## What Changes

- **新增「匯出 HTML」按鈕**（結束畫面）：按下後產出 self-contained HTML 並觸發瀏覽器下載；檔名 `debate-YYYYMMDD-HHMM.html`（時間取 `DebateState.startedAt`）。
- **新增 HTML 匯出產生器**（`src/exporter.js`）：`buildExportHtml(state)` 內嵌完整 CSS + 直接重用 `timeline.js` 的訊息卡渲染，確保視覺與畫面一致；`downloadExportHtml(state)` 透過 `Blob` + `URL.createObjectURL` + `<a download>` 觸發下載。
- **新增 metadata 段**：匯出檔頂部含辯題、正方/反方 CLI、N、首發、推理能力、開始/結束/匯出時間、結束方式（正常完成 / 使用者終止 / 中斷）、失敗 turn 計數。
- **`DebateState.exported` 欄位開始維護**：匯出成功後立即設為 `true` 並寫回 localStorage（欄位本身在 bootstrap 已預留、但無流程更新）。
- **新增「重新開始」未匯出確認對話框**：若 `state.exported === false`，按下「重新開始」彈出 3 鈕對話框（匯出後再開始 / 直接開始（不匯出） / 取消）；若已匯出則直接進彈窗。
- **匯出按鈕視覺回饋**：匯出成功後按鈕文字變為 `✓ 已匯出 <filename>（再匯一次）`、允許重複匯出。
- **HTML 注入防護**：辯題與所有發言內容於匯出時 escape `< > & " '` 五個字元，防止使用者輸入注入。

## Non-Goals

- 多場辯論歷史（仍只保留 localStorage 當前一場、長期歸檔靠匯出檔承擔）
- 自動雲端同步匯出檔
- 匯出 PDF / Markdown / 純文字格式（v2 可考慮）
- 匯出畫面預覽（按下直接下載）
- 匯出檔自帶互動功能（純靜態時間軸 + metadata）
- 重新開始確認對話框的鍵盤快捷鍵 / 焦點管理（v2 a11y 強化）
- 中文檔名匯出（已決議用 `debate-YYYYMMDD-HHMM.html` 避免跨平台問題）

## Capabilities

### New Capabilities

- `debate-export-html`：辯論結束畫面可將整場辯論匯出為 self-contained HTML 檔，含完整 metadata、時間軸、失敗紀錄；維護 `DebateState.exported` 旗標。
- `debate-restart-guard`：未匯出時「重新開始」會彈出確認對話框防止資料遺失。

### Modified Capabilities

(無 — 上述兩個皆為純新增，未動到先前 bootstrap 變更內的既有 capability 行為)

## Impact

- Affected specs: 新增 `openspec/specs/debate-export-html/spec.md` 與 `openspec/specs/debate-restart-guard/spec.md`
- Affected code:
  - New:
    - `src/exporter.js`：buildExportHtml / buildExportFilename / downloadExportHtml + 內嵌 CSS
    - `tests/exporter.test.js`：12 條 unit tests
  - Modified:
    - `app.js`：`renderEndedScreen` 新增匯出按鈕 + `showConfirmRestartDialog` 函式 + 重新開始 click handler 改寫
    - `styles.css`：新增 `.confirm-overlay` / `.confirm-dialog` 樣式
  - Removed: 無
