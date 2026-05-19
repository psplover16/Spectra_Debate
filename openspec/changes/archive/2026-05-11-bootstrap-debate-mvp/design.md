## Context

本變更為綠地 AI 辯論觀賞型網頁的基礎建設。專案目前在 `openspec/` 之外無任何源碼。需求由 `_private/discuss.txt` 啟動、經 `/spectra-discuss` 收斂為 `_private/propose.md`。

**核心約束與張力**：
- `openspec/config.yaml` 原描述為「純前端 + 本地 CLI、無後端」，但瀏覽器 sandbox 無法 spawn 本地進程。本變更承認此矛盾並引入本地 Node bridge（同變更內同步修正 config.yaml）。
- 兩 CLI（codexCli、claudeCli）的 reasoning effort 級距為**錯位 + 拼字不同**（claude 用 `xigh` 無 h、codex 用 `xhigh` 含 h），翻譯層需顯式區分。
- 使用者體驗定位為「觀賞型」— 開始辯論後使用者主要是觀看者，僅保留「終止」作為流程控制；不做暫停 / 繼續 / 手動推進按鈕。

**範圍邊界**：本變更含彈窗、流程狀態機、時間軸 UI、prompt 脈絡、effort 翻譯、localStorage 持久化；不含匯出 HTML 與未匯出提示對話框（後續變更承接）。

## Goals / Non-Goals

**Goals:**

- 提供可從零跑完一整場辯論的最小可用骨架（彈窗 → 自動推進 N 回合 + 結辯 → 結束畫面）
- 建立兩 CLI 整合的合約層（HTTP API + SSE 串流 + effort 翻譯表），便於後續變更增補功能
- 建立可測試的核心型別（Turn、DebateState、EffortLevel），保留立場互換的資料層空間
- 同步修正 `openspec/config.yaml`，消除架構描述與實作的矛盾

**Non-Goals:**

- 匯出 HTML、未匯出提示對話框（後續變更）
- 跨網站防護（採最寬鬆策略：僅綁 127.0.0.1、CORS allowall、無 token）
- CLI 失敗自動重試
- 立場中途互換的流程與 UI（僅保留資料層欄位）
- 第三方判定者 / 仲裁
- 兩 CLI 各自獨立的 effort 設定
- 訊息卡顯示推理等級
- 暫停 / 繼續 / 手動推進按鈕（「下一回合」為內部 event）
- 滾動視窗 / 歷史摘要（短場景上下文長度可承受完整重塞）
- Tauri / Electron 桌面殼層
- 使用者帳號、多場辯論歷史、雲端同步

## Decisions

### 採用本地 Node bridge 而非 Tauri / Electron 或手動貼上

**選擇**：本地 Node 腳本（`bridge.js`），瀏覽器 fetch / EventSource 對 `127.0.0.1:PORT` 通訊。

**替代方案**：
- *Tauri / Electron*：桌面殼層、一鍵啟動。代價：新增 Rust / Chromium 工具鏈、跨平台 build pipeline、個人專案體量過大。
- *手動貼上*：使用者自己跑 CLI 並貼回應到網頁。代價：違反「辯論扣緊對手回答」的自動連續對話精神。

**理由**：Node bridge 是最小架構擴張（多一支腳本）、最快驗證可行性、跨平台天然支援；未來若需打包成桌面 app，仍可把整套搬進 Tauri，反向不成立。

### CLI 串流選 SSE 而非 WebSocket 或 polling

**選擇**：bridge.js 經 `GET /turn/:id/stream` 推送 Server-Sent Events，前端用原生 `EventSource` 接收。

**替代方案**：
- *WebSocket*：雙向通訊。代價：bridge.js 需多一層協議、本案無回傳需求（前端不需中途回話給 CLI），純粹過度設計。
- *Polling*：前端每秒 GET 一次最新內容。代價：延遲與資源浪費、串流體驗劣。

**理由**：CLI 輸出本質單向（CLI → 前端），SSE 一條 long-lived HTTP 連線即可達成打字機效果；`EventSource` 原生支援自動重連雖此案不依賴。

### Prompt 脈絡採完整歷史重塞而非滾動視窗 / 摘要

**選擇**：每個 turn 的 prompt 包含從第 1 turn 到上一 turn 的所有發言（含失敗紀錄）。

**替代方案**：
- *只塞對手上一句*：失去長程一致性，第 5 回合可能遺忘第 1 回合的論點 → 自相矛盾風險高。
- *滾動視窗 + 摘要*：節省 token。代價：MVP 場景（N 最大 5、共 12 turn）的累積上下文遠低於 10k token，仍遠低於主流 CLI 上下文窗，摘要為 over-engineering。

**理由**：`_private/discuss.txt` 強調「扣緊主題與對手回答」+ 不自相矛盾；完整重塞是最簡單且能滿足這兩個要求的策略。每 turn 平均 200~500 字、最壞情境總脈絡仍可承受。

### Effort 翻譯採名稱對齊而非順位對齊

**選擇**：UI 5 級（low / medium / high / xhigh / max）對 claude 名稱直接對應；對 codex 名稱對齊但 UI max 封頂到 codex xhigh、codex minimal 不暴露給 UI。

兩 CLI 原生級距：
- claude：low / medium / high / xigh / max（注意第 4 級無 h）
- codex：minimal / low / medium / high / xhigh（注意第 5 級含 h）

**替代方案**：
- *順位對齊*：UI 第 N 級 → 各 CLI 第 N 級。代價：使用者選「高」時 codex 實際只到 medium、claude 在 high，兩者不同步且反直覺。

**理由**：「我選高、兩 CLI 都是 high」這個心智模型優先；codex 的 minimal 屬於極端快速場景、辯論不需要。**翻譯表必須以字面值寫入 xigh（claude）與 xhigh（codex），並由 unit test 斷言**，避免被 IDE / formatter 自動修正成同一字串。

### 狀態機採自動推進 + 永久終止二元模型而非暫停 / 繼續四鈕

**選擇**：UI 唯一使用者控制 = 「終止」按鈕（語意為永久結束）；「下一回合」為狀態機內部 event、不暴露為 UI 按鈕；無暫停 / 繼續概念。

**替代方案**：
- *暫停 + 繼續 + 下一回合 + 終止*：完整四鈕。代價：「觀賞型」定位下使用者多數時間不操作，多三個鈕反而增加心智負擔。
- *每回合需手動按下一回合*：完全手動。代價：破壞連續觀看體驗。

**理由**：使用者主流為觀賞、僅在異常時介入；二元模型最簡且不損失關鍵能力。CLI 卡住時直接按終止重來，比「暫停後決定是否繼續」更乾脆。

### CLI 失敗採跳過 + 標註而非重試 / 終場

**選擇**：CLI 逾時 90 秒、非 0 exit code、stderr 噴錯、空字串輸出 — 一律標註該 turn 為 failed 並推進到下一 turn；UI 顯示為灰底 ⚠ 卡片但保留位置；不重試、不終場、不詢問使用者。

**替代方案**：
- *自動重試 N 次*：增加魯棒性。代價：實作 backoff、UX 上「為何卡這麼久」需多寫狀態提示、MVP 過度。
- *失敗即終場*：全場結束。代價：對使用者太挫折，一次小故障毀整場觀看。

**理由**：辯論的價值在「過程」、單一 turn 失敗仍可繼續推進、最終結果有部分發言即可保留主軸；失敗紀錄持久化讓使用者能後續查閱。

### 持久化採 localStorage 單一 slot 而非 IndexedDB / 多場歷史

**選擇**：當前辯論存 `spectra-debate:current`、彈窗上次輸入存 `spectra-debate:lastFormValues`；只保留**當前一場**辯論、無歷史 slot 概念。

**替代方案**：
- *IndexedDB + 多場歷史*：可重看任何過往辯論。代價：MVP 不需要、Spectra 後續變更會加入匯出 HTML（每場辯論可獨立存檔），歷史功能由匯出檔承擔即可。

**理由**：avoiding 多場歷史與匯出功能的職責重疊；單一 slot + 匯出 = 簡單 schema + 使用者可控的長期保存。

### 載入時不自動續跑而是顯示結束畫面

**選擇**：頁面重新整理後若 `current.turns` 非空但 `endedAt` 不存在（中斷狀態），不自動重啟 CLI、直接顯示「上次未完成」結束畫面。

**替代方案**：自動續跑下一個未完成的 turn。代價：重整意外觸發 CLI 啟動可能產生重複費用 / 困惑、且使用者期待是「保留現場」而非「自動接著跑」。

**理由**：行為的可預測性 > 自動化便利；使用者若想續跑，可點「重新開始」並重新設定。

## Implementation Contract

### bridge.js HTTP API

**啟動**：`node bridge.js`（terminal 留著顯示 log），預設綁定 `127.0.0.1:7456`（port 可由環境變數 `BRIDGE_PORT` 覆寫）。

**端點 1 — 啟動回合**：
- `POST /turn`
- Request JSON：`{ cli, stance, prompt, effortLevel }`，其中 cli 為 codex / claude、stance 為 pro / con、effortLevel 為 low / medium / high / xhigh / max。
- Response JSON：`{ turnId }`（UUID 或時序字串）。
- 行為：bridge.js 內部 `spawn(cliBinary, [...effortFlags, ...其他必要參數], { shell: false })`，將 prompt 由 stdin 餵給子程序、紀錄 turnId 對應 child process。

**端點 2 — 串流回應**：
- `GET /turn/:turnId/stream`
- Response：`text/event-stream`，連續推送 `data: {"chunk": "..."}` 事件直到 CLI 結束；結束時推 `data: {"done": true}`；錯誤推 `data: {"error": "..."}` 並關閉連線。
- 行為：bridge.js 監聽子程序 stdout、每收到一塊資料即推送一次 SSE 訊息。

**端點 3 — 終止當前回合**：
- `POST /turn/:turnId/abort`
- Response JSON：`{ ok: true }`
- 行為：對對應 child process 呼叫 `child.kill('SIGTERM')`；隨後 stream 端點會發出 error 訊息並關閉。

**CORS 與綁定**：所有回應加 `Access-Control-Allow-Origin: *`；`server.listen(port, '127.0.0.1')` 拒絕外部裝置接入。

**逾時**：每個 turn bridge.js 內建 90 秒 `setTimeout`，到時 `child.kill('SIGTERM')` + 推送 error 訊息。

### Effort 翻譯表

bridge.js 維護兩張字面對照表（flag 名稱於 apply 階段查 `--help` 補入 `<FLAG>`）：

```
codexEffortMap:
  low    -> [<FLAG>, low]
  medium -> [<FLAG>, medium]
  high   -> [<FLAG>, high]
  xhigh  -> [<FLAG>, xhigh]    // codex 原生含 h
  max    -> [<FLAG>, xhigh]    // codex 無 max，封頂

claudeEffortMap:
  low    -> [<FLAG>, low]
  medium -> [<FLAG>, medium]
  high   -> [<FLAG>, high]
  xhigh  -> [<FLAG>, xigh]     // claude 原生無 h — 已確認非筆誤
  max    -> [<FLAG>, max]
```

`translateEffort(level, cli)` 函式回傳字串陣列供 spawn 第二參數展開。

### 核心型別（強制資料層雙欄位）

```
type Stance = pro | con
type CliName = codex | claude
type EffortLevel = low | medium | high | xhigh | max
type TurnStatus = pending | streaming | done | failed
type TurnKind = debate | closing

Turn:
  index: number (1-based)
  cli: CliName             // 哪個 CLI 講的
  stance: Stance           // 該回合立場（獨立於 cli，不可 derive）
  kind: TurnKind
  content: string
  status: TurnStatus
  errorMessage?: string
  startedAt: string (ISO 8601)
  endedAt?: string

DebateState:
  topic: string
  proSide: CliName         // 哪個 CLI 當正方
  conSide: CliName         // 自動推導 = 另一個
  perSideCount: number     // 使用者選的 N，2~5
  firstSpeakerStance: Stance
  effortLevel: EffortLevel
  turns: Turn[]
  startedAt: string
  endedAt?: string
  endReason?: completed | terminated
  exported: boolean        // 本變更內固定為 false；由後續匯出變更維護
```

`Turn.cli` 與 `Turn.stance` **必須**同時存在、不得用任一推論另一；為日後立場互換預留 schema。

### Prompt Template

**主辯版**（給第 1 到倒數第 3 個 turn 使用）：

```
你正在參與一場辯論。

辯題：{topic}
你的立場：{stance 中文化}
這是第 {turnIndex} 個 turn（共 {totalTurns} 個，含結辯）
本回合性質：主辯論

---
辯論歷史（依時序）：

{每個已完成 turn 渲染為一段}
{stance 中文化}({cli}): {content}

{失敗 turn 渲染為}
{stance 中文化}({cli}): ⚠ 該回合 CLI 失敗，無發言內容

---
現在輪到你發言。
要求：
- 必須緊扣辯題
- 必須針對對手上一段發言的論點直接回應（若上一段為失敗，則延續你方此前論點推進）
- 不得自相矛盾於你之前的立場
- 約 200~400 字
- 直接輸出辯論內容，不要任何前言、不要 markdown 標題、不要重複「正方/反方:」前綴
```

**結辯版**（給最後 2 個 turn 使用）：主辯版上半部相同，「本回合性質」改為「**結辯**」；底部要求改為：
```
現在是你的結辯回合。
要求：
- 總結你方的核心論點（依本場已陳述的內容）
- 反駁對方最關鍵的 1~2 個論點
- 不得提出全新主張（結辯不開新戰線）
- 約 300~500 字
- 直接輸出，不要前言、不要 markdown、不要前綴
```

### localStorage Schema

- Key `spectra-debate:current`：序列化的 DebateState
- Key `spectra-debate:lastFormValues`：`{ topic, proSide, perSideCount, firstSpeakerStance, effortLevel }`

**寫入時機**：
- 彈窗確定 → 建立 DebateState 立即寫入
- 每個 turn 由 streaming 轉為 done 或 failed → 寫入
- 結束畫面進入時 → 寫入 endedAt / endReason
- 串流逐字過程中**不寫**（避免高頻 I/O）

**載入時機**：
- 頁面開啟 → 讀 current：若有 endedAt 顯示結束畫面；若 turns 非空但無 endedAt 顯示「上次未完成」結束畫面、不自動續跑；若無 current 顯示彈窗
- 彈窗開啟 → 讀 lastFormValues 填入預設

### 狀態機轉移

```
[彈窗 Idle]
  └─ 開始 → [進行中 turn k]
                ├─ CLI 串流結束 (status=done)
                │   ├─ k < 最終 turn  → 內部 next-turn event → [進行中 turn k+1]
                │   └─ k = 最終 turn  → [結束畫面 endReason=completed]
                ├─ CLI 逾時 / 失敗 (status=failed)
                │   └─ 同上分流（失敗也算「完成該 turn」、推進）
                └─ 使用者按終止 → [結束畫面 endReason=terminated]
[結束畫面]
  └─ 重新開始 → [彈窗 Idle]（保留 lastFormValues）
```

「終止」不可逆；「重新開始」會覆寫 current slot。

### 失敗模式

| 觸發 | bridge.js 行為 | 前端行為 | turn.status | turn.errorMessage |
|---|---|---|---|---|
| 90 秒逾時 | SIGTERM + SSE error | 收到 error 即標註失敗、推進 | failed | CLI 逾時（90 秒未回應） |
| 非 0 exit code | SSE error 含 stderr 前 200 字 | 同上 | failed | CLI 異常結束: ... |
| 空字串輸出 | SSE 直接 done 但 chunk 全空 | 偵測到內容為空標註失敗 | failed | CLI 回傳空內容 |
| 子程序 spawn error | SSE error | 同上 | failed | 無法啟動 CLI: ... |
| 使用者按終止 | SIGTERM 當前 child | 切到結束畫面 | 當前 turn 標 failed 或 done（看是否已收到內容）；後續 turn 不執行 | 使用者終止（若 status=failed） |

### 驗收

實作完成時應可：
- 在 terminal 跑 `node bridge.js`、無錯誤、log 顯示 Listening on http://127.0.0.1:7456
- 在瀏覽器開 index.html（雙擊 file:// 或經 http://127.0.0.1:7456/ 任一方式），看到彈窗
- 5 欄校驗：辯題 3 字以下 / 101 字以上提交按鈕 disabled；N=1 / N=6 disabled
- 提交後進入時間軸畫面，CLI 回應逐字出現
- 整場辯論跑完（N=3 預設 = 共 8 turn）後進入結束畫面、看到「重新開始」按鈕
- 跑到一半按終止 → 立刻進入結束畫面、最後一個 turn 標為 failed: 使用者終止
- 重新整理頁面 → 依當前狀態顯示對應畫面（彈窗 / 結束畫面，**絕不自動續跑**）
- 兩 CLI 翻譯表 unit test 通過、包含 xigh / xhigh 字面值斷言

### 範圍邊界（避免 apply 漂移）

**In scope**：彈窗、流程狀態機、時間軸 UI、prompt template（主辯 + 結辯）、effort 翻譯、bridge.js HTTP API、localStorage 持久化、`openspec/config.yaml` 架構描述修正。

**Out of scope（即使順手會碰到）**：
- 匯出 HTML 按鈕與功能
- 「重新開始」未匯出提示對話框
- CSRF token / origin allowlist
- CLI 失敗重試
- 立場互換的 UI 切換
- 多場歷史 UI
- Tauri / Electron 打包

## Risks / Trade-offs

- **bridge.js 需另外啟動** → bridge.js 入口加 friendly log（「請保持此 terminal 開啟」），README 註明兩步驟啟動；未來考慮整合 npm start 同時啟動 static server + bridge。
- **localhost CORS allowall 易遭其他分頁 CSRF 攻擊** → 明確列為非範圍、註明於 README「個人單機使用、勿在共享機器執行」；未來變更可加 token / origin check 收緊。
- **claude 拼字 xigh（無 h）易被 IDE / formatter 自動修正為 xhigh** → unit test 強制斷言字面值、PR 範本提醒。
- **兩 CLI 實際 flag 名稱在 design 階段尚未知** → 翻譯表結構先固化，flag 名稱在 apply 階段跑 `--help` 後填入；apply 階段第一個任務即為「查 CLI flag 名稱並更新翻譯表」。
- **完整歷史重塞在極端長場景可能撐爆 context window** → MVP 限 N 最大 5、最大共 12 turn、估算 10k token 以下，遠低於主流上下文窗；若未來放寬 N，需切到滾動視窗策略。
- **localStorage 容量上限約 5MB** → 一場辯論最大估約 12 turn × 500 字 約 7.2KB，遠低於上限，無風險。
- **endedAt 未存在但 turns 非空的中斷狀態不自動續跑可能讓使用者誤以為「壞掉」** → 結束畫面明確顯示「上次未完成（中斷於 turn N）」+ 「重新開始」按鈕，避免歧義。
