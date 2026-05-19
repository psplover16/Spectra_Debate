## 1. 發言次數上限放寬（Per-Side Turn Count Constrained to 2 Through 999 Inclusive）

- [x] 1.1 實作 Per-Side Turn Count Constrained to 2 Through 999 Inclusive：將 `src/validators.js` 的 `PER_SIDE_MAX` 常數從 5 改為 999，對應「常數集中化：PER_SIDE_MAX 改為 999」決策。驗證：執行 `npm test tests/validators.test.js`，確認 `validatePerSideCount(999)` 回傳 valid、`validatePerSideCount(1000)` 回傳 invalid 且訊息含 2~999。
- [x] 1.2 將 `src/turn-plan.js` 的本地常數 `PER_SIDE_MAX` 從 5 改為 999，對應同一決策。驗證：執行 `npm test tests/timeline.test.js`（或 `npm test`），確認 `buildTurnPlan` 以 `perSideCount=999` 呼叫時不拋例外。
- [x] 1.3 將 `src/state.js` 的 `createInitialDebateState` 中硬編碼的上限檢查 `> 5` 改為 `> 999`。驗證：執行 `npm test tests/state.test.js`，確認以 `perSideCount=999` 建立 state 不拋例外，以 `perSideCount=1000` 拋例外。
- [x] 1.4 更新 `tests/validators.test.js` 的邊界測試：新增 `perSideCount=999` 為合法、`perSideCount=1000` 為非法的斷言，移除舊的 `perSideCount=6` 非法斷言。驗證：`npm test tests/validators.test.js` 全部通過。

## 2. 設定彈窗 UI（Each Side May Optionally Specify an AI Persona）

- [x] 2.1 實作 Each Side May Optionally Specify an AI Persona（正方）：在 `src/setup.js` 的 `renderSetupPopup` 中，於正方 CLI 欄位（`data-field="proSide"`）後緊接新增正方身分 text input（`data-field="proPersona"`，placeholder 可為空，預設值取自 `initial.proPersona ?? ""`）。驗證：在瀏覽器開啟辯論設定彈窗，確認「正方身分」input 出現在正方 CLI 選擇下方。
- [x] 2.2 在 `src/setup.js` 中，於反方 CLI label（自動推算，目前無獨立欄位）後新增反方身分 text input（`data-field="conPersona"`，預設值取自 `initial.conPersona ?? ""`）。驗證：在瀏覽器確認「反方身分」input 出現在畫面中（若無反方 CLI 顯示欄，可放在「誰先發言」前）。
- [x] 2.3 將 `proPersona` 與 `conPersona` 加入 `readForm(root)` 的回傳物件、`updateValidity` 監聽迴圈的欄位清單、確定回呼的 `saveLastFormValues(form)` payload，對應「Form Values Persist Across Sessions」需求。驗證：填入身分確定後，`localStorage.getItem('spectra-debate:lastFormValues')` 含 `proPersona` 與 `conPersona` 欄位；重新整理後彈窗兩欄位正確還原（包含舊版 lastFormValues 無這兩欄時顯示空字串）。

## 3. 狀態模型（Persona 存放於 DebateState 頂層）

- [x] 3.1 修改 `src/state.js` 的 `createInitialDebateState`：input 新增可選欄位 `proPersona?: string` 與 `conPersona?: string`，缺省或 undefined 時預設 `""`；回傳的 DebateState 新增 `proPersona: string`、`conPersona: string` 兩欄位，對應「Persona 存放於 DebateState 頂層」決策。驗證：執行 `npm test tests/state.test.js`，確認傳入 persona 時 state 含對應值、未傳入時兩欄位均為 `""`。

## 4. Prompt 注入（Persona Declaration Injected Into Prompt Header When Assigned）

- [x] 4.1 實作 Persona Declaration Injected Into Prompt Header When Assigned：修改 `src/prompt.js` 的 `buildPrompt`，input 新增可選 `persona?: string`；header 組裝時，在 `你的立場：` 行後、`這是第 N 個 turn` 行前，若 `persona` 非空字串則插入 `你的身分：[persona]` 行，空字串或缺省時完全不輸出，對應「buildPrompt 新增可選 persona 參數」決策。驗證：執行 `npm test tests/prompt.test.js`，確認 persona 非空時輸出含 `你的身分：Junior 前端工程師`（或指定值），persona 為 `""` 時輸出不含 `你的身分：`。
- [x] 4.2 修改 `src/state-machine.js` 呼叫 `buildPrompt` 處：依 `turn.stance` 從 `state.proPersona` / `state.conPersona` 解析出對應 persona 字串後傳入，對應同一決策。驗證：執行 `npm test`（全套），確認無迴歸；手動以「正方身分=律師」啟動一場辯論，觀察 bridge 日誌或 prompt 輸出首行包含 `你的身分：律師`。
- [x] 4.3 更新 `tests/prompt.test.js`：新增兩個測試案例——（a）`persona` 為 `"Junior 前端工程師"` 時輸出含 `你的身分：Junior 前端工程師` 且位於立場行後、turn 序號行前；（b）`persona` 為 `""` 時輸出不含 `你的身分：`。驗證：`npm test tests/prompt.test.js` 全部通過。
