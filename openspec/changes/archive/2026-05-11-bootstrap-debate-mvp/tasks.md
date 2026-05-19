## 1. 專案骨架與本地 bridge 啟動

- [x] 1.1 建立 `package.json` 宣告 Node 入口（`node bridge.js`）、最低 Node 版本 18、執行腳本（例如 `npm start` 啟動 bridge）；驗證：terminal 跑 `npm start` 與 `node bridge.js` 皆能正常啟動且不報錯。
- [x] 1.2 在 `bridge.js` 實作 Bridge Binds Only to Loopback Interface — 預設 port 7456、讀 `BRIDGE_PORT` 環境變數覆寫、`server.listen(port, '127.0.0.1')`；驗證：terminal 跑 `node bridge.js` 看到 log `Listening on http://127.0.0.1:7456`；從同網段另一機 `curl <LAN_IP>:7456/turn` 應被拒絕；設 `BRIDGE_PORT=8000` 重跑後 log 顯示新 port。
- [x] 1.3 在 `bridge.js` 實作 Bridge Permits Cross-Origin Requests via Wildcard — 所有 HTTP 回應加 header `Access-Control-Allow-Origin: *`；驗證：`curl -H "Origin: file://" -i http://127.0.0.1:7456/turn` 回應 header 含 `Access-Control-Allow-Origin: *`；瀏覽器 `file://` 開啟 `index.html` 後 fetch 不被 CORS 擋。
- [x] 1.4 同步修正 `openspec/config.yaml` 架構描述（將「純前端 + 本地 CLI、無後端、無資料庫」改為「前端 UI + 本地 Node bridge（單機執行）」），落實 design.md「採用本地 Node bridge 而非 Tauri / Electron 或手動貼上」決策；驗證：`grep -n "純前端\|無後端" openspec/config.yaml` 應無相關描述、新描述含「本地 Node bridge」字樣；`spectra validate bootstrap-debate-mvp` 仍通過。

## 2. bridge.js CLI 子程序與安全層

- [x] 2.1 在 `bridge.js` 實作 Bridge Spawns CLIs Without Shell Interpretation — 所有 CLI 呼叫使用 `child_process.spawn(cmd, argsArray, { shell: false })`、嚴禁字串拼接執行；驗證：unit test 用 topic = `; rm -rf /` 觸發 spawn 後檢查 args 為陣列且不含 shell wrapper；手動跑 POST `/turn` 該 topic 後 OS 工具（Windows Task Manager / `ps`）顯示 child 為 CLI 二進制本身、非 sh / cmd。
- [x] 2.2 在 `bridge.js` 實作 POST /turn Launches a CLI Subprocess and Returns a Turn ID — 接收 JSON body `{ cli, stance, prompt, effortLevel }`、生成 turnId、spawn 子程序、prompt 經 stdin 餵入、紀錄 turnId 對 child 的映射、回 `{ turnId }`；驗證：unit test 對 mock spawn 斷言被以正確 args 呼叫；手動 `curl -X POST -d '{...}' http://127.0.0.1:7456/turn` 回應為 200 + 含非空 `turnId` 的 JSON、bridge log 顯示子程序 pid。
- [x] 2.3 在 `bridge.js` 實作 GET /turn/:turnId/stream Streams Output via Server-Sent Events — 串流 child stdout 為 `data: {"chunk": "..."}`、完成時推 `{"done": true}`、失敗推 `{"error": "..."}`、發完即關閉，對應 design.md「CLI 串流選 SSE 而非 WebSocket 或 polling」與「bridge.js HTTP API」決策；驗證：以 mock echo child 跑端對端、`curl -N http://127.0.0.1:7456/turn/<id>/stream` 依序看到 chunk → done → 連線關閉。
- [x] 2.4 在 `bridge.js` 實作 POST /turn/:turnId/abort Terminates the Running Subprocess — 對對應 child 發 `SIGTERM`、回 `{ ok: true }`、對應 stream 端發 error event 後關閉；驗證：unit test 啟動 long-running mock child 後 abort，斷言 `child.killed === true` 且 stream 收到 error event；手動跑長 prompt 中按終止，bridge log 顯示 child kill。
- [x] 2.5 在 `bridge.js` 實作 90-Second Per-Turn Timeout Terminates Stuck CLIs — 每 turn 內建 `setTimeout(90000)`、到時 SIGTERM + SSE error；驗證：unit test 注入永不結束的 mock child、在 91 秒後檢查 stream 收到含 timeout 字樣的 error event、process 已 kill；落實 design.md「失敗模式」中的 timeout 路徑。

## 3. Effort 翻譯層

- [x] 3.1 在 `bridge.js`（或專屬模組）實作 Effort Translation Uses Two Distinct Per-CLI Maps With Verified Literal Values — 建立 `codexEffortMap` 與 `claudeEffortMap` 兩張對照表（flag 名稱以 `<FLAG>` 佔位）與 `translateEffort(level, cli)`，對應 design.md「Effort 翻譯表」與「Effort 翻譯採名稱對齊而非順位對齊」；驗證：unit test 斷言 5 個 UI 等級在兩 CLI 各自的字面值，**必含** `expect(claudeEffortMap.xhigh[1]).toBe('xigh')`（無 h）與 `expect(codexEffortMap.xhigh[1]).toBe('xhigh')`（含 h）與 `expect(codexEffortMap.max[1]).toBe('xhigh')`（封頂）。
- [x] 3.2 跑 `codex --help` 與 `claude --help`（或查官方文件）取得實際 reasoning effort flag 名稱、替換 `codexEffortMap` 與 `claudeEffortMap` 內的 `<FLAG>` 佔位為真實旗標；驗證：bridge.js 啟動後 POST `/turn` 帶 `effortLevel: "medium"`，bridge log 顯示 spawn args 含正確 flag；unit test 對 spawn args 做正則斷言確認 flag 名稱已從佔位替換為實值。

## 4. 前端骨架、彈窗與核心型別

- [x] 4.1 建立 `index.html`、`app.js`、`styles.css` 骨架（空畫面 + 載入時讀 localStorage 決定畫面），讓 file:// 雙擊與 `http://127.0.0.1:7456/` 兩種開啟方式都可運作；驗證：兩種開啟方式 DevTools console 皆無未捕捉錯誤、首屏依 localStorage 狀態顯示彈窗或結束畫面。
- [x] 4.2 在 `app.js` 建立 `Stance` / `CliName` / `EffortLevel` / `TurnStatus` / `TurnKind` 常數與 `createTurn(...)` / `createInitialDebateState(...)` 工廠函式，落實 design.md「核心型別（強制資料層雙欄位）」 — `Turn` 必同時帶 `cli` 與 `stance` 兩獨立欄位、不得互相 derive；驗證：unit test 對工廠函式產出的 Turn 物件斷言 `cli` 與 `stance` 分別存在；對 `DebateState` 斷言含 `proSide` / `conSide` 並 `conSide !== proSide`。
- [x] 4.3 在 `app.js` 實作 Debate Setup Popup Appears Before Each Debate — 5 欄彈窗（辯題、正方 CLI、N、首發、effort）與確定按鈕，可由 localStorage 已存在的 `current` 狀態抑制顯示；驗證：清空 localStorage 後重整，彈窗顯示且各欄預設值符合 spec（topic 空、proSide codex、N=3、firstSpeaker pro、effort medium）。
- [x] 4.4 在 `app.js` 實作 Topic Validation Enforces Length Bounds — trim 後 4~100 字校驗驅動確定按鈕 disable/enable + 顯示提示；驗證：unit test 對長度 3/4/100/101 四個邊界值各別斷言按鈕 disabled / enabled。
- [x] 4.5 在 `app.js` 實作 Per-Side Turn Count Constrained to 2 Through 5 Inclusive — number / select 輸入限制範圍與 step；驗證：手動輸入 1 / 6 確定按鈕 disabled、輸入 2 / 3 / 4 / 5 enabled。
- [x] 4.6 在 `app.js` 實作 Form Values Persist Across Sessions — 確定按下時把 5 欄寫入 `spectra-debate:lastFormValues`、彈窗開啟時讀此 key 填預設；驗證：DevTools 確認 confirm 後 localStorage 出現該 key、重整頁面彈窗 5 欄帶上次值。

## 5. 訊息時間軸 UI

- [x] 5.1 在 `app.js` 與 `styles.css` 實作 Messages Render in Vertical Time-Ordered Timeline — 訊息卡 100% 寬度上下排列、依 turn.index 渲染；驗證：模擬 3 turn 完成後 DOM 順序與 `turns[].index` 一致、無 flex / grid 左右分欄樣式。
- [x] 5.2 實作 Pro and Con Use Distinct Color Schemes — 正方藍系、反方紅系，套用到訊息卡 border 與 chip 背景；驗證：unit test 對 mock pro/con turn 渲染後查 computed style 含對應色系類名；視覺截圖（pro vs con）貼進 PR 比較。
- [x] 5.3 實作 Each Message Card Has a Chip Header Identifying Stance and CLI — chip 在卡左上、時間在卡右上、內文為獨立段；驗證：unit test 對 (pro, codex) 與 (con, claude) turn 渲染後 chip textContent 各含 `正方` + `codex` 與 `反方` + `claude`。
- [x] 5.4 實作 Streaming Content Renders Incrementally — 用 `EventSource` 接 bridge SSE，每收 chunk 就 append 到當前 turn 卡的內文；驗證：mock EventSource 連發 "Hello" / " " / "World" 三 chunk，DOM textContent 應在三次事件後分別為 `Hello` / `Hello ` / `Hello World`。
- [x] 5.5 實作 Failed Turns Render as Distinct Warning Cards — 灰底、⚠ 標記、errorMessage 放內文位置、chip 仍含 stance 與 cli；驗證：unit test 對 `status: 'failed'`、`errorMessage: 'CLI 逾時'` 的 turn 渲染後 DOM 含警示樣式類名與 `CLI 逾時` 字串。
- [x] 5.6 實作 Closing Turns Are Marked in the Chip Header — `kind: 'closing'` 的 turn chip 多一結辯標記、`kind: 'debate'` 沒有；驗證：unit test 對 closing 與 debate 兩種 turn 渲染後 chip textContent 差異斷言。

## 6. 流程狀態機與終止控制

- [x] 6.1 在 `app.js` 實作 Turn Order Is Determined by First Speaker Selection — 依 `firstSpeakerStance` 與 `perSideCount` 產生完整 turn 計畫（stance 序列 + kind 序列），落實 design.md「狀態機轉移」；驗證：unit test 對 `(pro, 3)` 斷言 8 turn 序列符合 spec scenario；對 `(con, 2)` 斷言 6 turn 序列符合 spec scenario。
- [x] 6.2 實作 Last Two Turns Are Always Closing Turns — turn 計畫的最後 2 筆 `kind === 'closing'`、其餘 `'debate'`；驗證：上一條 unit test 同時斷言 kind 序列；對 `(pro, 5)` 斷言 12 turn 中前 10 為 debate、後 2 為 closing。
- [x] 6.3 實作 Automatic Advancement After Each Turn Completes — turn 由 `streaming` 進入 `done` 或 `failed` 後內部 next-turn event 立即觸發下一 turn 的 spawn，UI 不渲染「下一回合」按鈕，落實 design.md「狀態機採自動推進 + 永久終止二元模型而非暫停 / 繼續四鈕」；驗證：unit test 模擬 turn k 切 done，斷言 turn k+1 在 50 ms 內變為 `streaming`；DOM 全文 query `button` 不出現任何「下一回合」字樣的按鈕。
- [x] 6.4 實作 Terminate Button Is the Only User Flow Control During Running Debate — 進行中畫面有且僅有一顆「終止」按鈕、點擊呼叫 bridge `/abort` 並切結束畫面、`DebateState.endedAt` 立即填入、`endReason = 'terminated'`；驗證：unit test 模擬辯論進行中按終止後 `state.endedAt` 非空且 `state.endReason === 'terminated'`、後續 turn 不再 spawn；手動跑辯論到 turn 2 按終止，bridge log 顯示 child kill。
- [x] 6.5 實作 CLI Failure or Timeout Skips the Turn Without Terminating the Debate — bridge 推 error event 時，當前 turn 標 `failed`、寫入 errorMessage、不重試、不結場、自動進下一 turn，落實 design.md「CLI 失敗採跳過 + 標註而非重試 / 終場」與「失敗模式」；驗證：unit test mock bridge 第 2 turn 回 error，斷言 turn 2 `status === 'failed'`、turn 3 自動啟動且狀態為 `streaming`。

## 7. Prompt 脈絡與 template

- [x] 7.1 在 `bridge.js` 實作 Each Turn Prompt Embeds the Full Prior Debate History — 每次 spawn 前依當前 `DebateState.turns` 完整重塞歷史（第 1 ~ k-1 turn）、依時序渲染為 `{stance label}({cli}): {content}` 段落，落實 design.md「Prompt 脈絡採完整歷史重塞而非滾動視窗 / 摘要」與「Prompt Template」；驗證：unit test 對含 4 個 done turn 的 state 產生第 5 turn prompt 後斷言 prompt 字串依序含 4 個 content、且 stance label / cli 標頭存在。
- [x] 7.2 實作 Failed Turns Appear in History as Explicit Placeholders — 失敗 turn 在歷史段渲染為 `{stance}({cli}): ⚠ 該回合 CLI 失敗，無發言內容` 而非空白；驗證：unit test 含 1 個 failed turn 的 state 產生下個 prompt 後，斷言該 turn 的歷史段落含失敗標記、不含失敗 turn 的任何 content / errorMessage 內文。
- [x] 7.3 實作 Main Debate Prompt Requires Direct Rebuttal and Non-Contradiction — `kind: 'debate'` turn 的 prompt 含「直接回應對手上一段」「不得自相矛盾」明確指令；驗證：unit test 對 debate kind prompt 斷言含上述兩段中文字串子集。
- [x] 7.4 實作 Closing Prompt Requires Summary and Rebuttal Without New Arguments — `kind: 'closing'` turn 的 prompt 含「總結」「反駁」「不得提出全新主張」三項指令；驗證：unit test 對 closing kind prompt 斷言含上述三段中文字串子集。
- [x] 7.5 實作 Prompt Header Identifies Topic, Stance, Turn Index, Total Turn Count, and Kind — 所有 prompt 開頭含 5 項標頭（辯題、立場、turn index、總 turn 數、kind）；驗證：unit test 對任一 prompt 斷言開頭 200 字內含 topic 原文、stance 中文 label、turnIndex 十進位整數、totalTurns 十進位整數、kind 字串（主辯論 / 結辯）。

## 8. localStorage 持久化

- [x] 8.1 在 `app.js` 實作 DebateState Persists to localStorage After Each Turn Completes — 每個 turn 由 `streaming` 轉 `done` / `failed` 時序列化整個 DebateState 寫入 `spectra-debate:current`，串流逐字過程不寫，落實 design.md「localStorage Schema」與「持久化採 localStorage 單一 slot 而非 IndexedDB / 多場歷史」；驗證：unit test mock localStorage.setItem 計次，模擬完整 8-turn 場後 setItem 對該 key 的呼叫次數 = 1（開場）+ 8（每 turn 完成）+ 1（endedAt）；streaming 階段 chunk 接收期間 setItem 無新呼叫。
- [x] 8.2 實作 Last Form Values Persist Separately From Debate State — 確定按下時除 `current` 外另寫 `spectra-debate:lastFormValues`、兩個 key 互不引用；驗證：unit test 觀察兩次寫入的時機與 payload、確認 `lastFormValues` 只含 5 個欄位（topic / proSide / perSideCount / firstSpeakerStance / effortLevel）。
- [x] 8.3 實作 Single Slot Only With No Historical Debate Storage — 開新辯論直接覆寫 `current`、不另開歷史 key；驗證：unit test 先 seed 一個舊 `current` 再開新辯論，斷言 localStorage 內僅有 `spectra-debate:current` + `spectra-debate:lastFormValues` 兩個 key、且 `current` 內容已被新初始狀態取代。
- [x] 8.4 實作 Page Load Routes the User Based on Persisted State — 載入時讀 `current`：endedAt 存在 → 結束畫面；turns 非空且無 endedAt → 中斷結束畫面；無 current → 彈窗；不自動重啟 CLI，落實 design.md「載入時不自動續跑而是顯示結束畫面」；驗證：unit test 分別 seed 三種 state 後呼叫初始化函式，斷言渲染元件分別為 ended-screen-with-timeline / ended-screen-with-interrupted-indicator / setup-popup；其中中斷情境斷言 bridge.js 未被呼叫。

## 9. 整合驗收

- [x] 9.1 手動端對端驗證一場完整辯論（bridge.js 啟動後在瀏覽器跑 `index.html`、N=3 預設）— 確認自動推進、串流逐字、共 8 turn 跑完進結束畫面、出現「重新開始」按鈕；驗證：bridge.js terminal log 無 error；最終 localStorage `spectra-debate:current` 含 `endedAt`、`endReason: 'completed'`、`turns.length === 8`；DevTools console 無未捕捉錯誤；截圖貼進 PR。
- [x] 9.2 手動端對端驗證「使用者終止 + 重新整理保留現場」場景 — 開始辯論到 turn 2 按終止，立即進結束畫面；接著重新整理頁面，應仍顯示結束畫面且帶「上次未完成」中斷標記、bridge 未被自動呼叫，落實 design.md「載入時不自動續跑而是顯示結束畫面」；驗證：重整後 DevTools Network 面板 0 個對 bridge 的請求、UI 為 ended-screen-with-interrupted-indicator、`spectra-debate:current.endedAt` 已存在但 `turns.length` < 8。
- [x] 9.3 手動端對端驗證「CLI 失敗跳過」場景 — 暫時讓 codex 或 claude 失效（rename binary 或暫時清空 PATH），開始辯論觀察失敗 turn 標為灰底 ⚠ 卡片、辯論仍推進到下一 turn 而非終場；驗證：失敗的 turn DOM 含警示樣式類名；最終 localStorage 中該 turn `status: 'failed'`、`errorMessage` 含失敗描述；後續 turn 仍正常完成；對應 design.md「失敗模式」表中的非 0 exit code 路徑。
- [x] 9.4 對照 design.md「範圍邊界（避免 apply 漂移）」逐條 sanity check — In scope 8 項全部已交付（彈窗 / 流程狀態機 / 時間軸 UI / prompt template / effort 翻譯 / bridge.js HTTP API / localStorage 持久化 / config.yaml 修正）、Out of scope 7 項在 codebase 內無痕跡（匯出 HTML 按鈕、未匯出提示對話框、CSRF/origin token、CLI 重試、立場互換 UI、多場歷史 UI、Tauri/Electron）；驗證：PR 描述附「In scope 已交付 vs Out of scope 未引入」對照表；`git diff --stat` 內無 `export.html` / `electron` / `tauri` / `retry` / `origin-check` 相關新檔；`grep -rin "exportHTML\|electron\|tauri\|retryTurn\|swapStance" .` 在新增的 `.js` / `.css` / `.html` 內回傳 0 行。
