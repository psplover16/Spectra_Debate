## Context

本次變更涉及兩個獨立但同屬「設定彈窗」域的功能調整：

1. **發言次數上限放寬**：`PER_SIDE_MAX` 常數目前散落在 `src/validators.js` 與 `src/turn-plan.js` 兩處，均硬編碼為 5。
2. **AI 身分（Persona）**：設定彈窗新增兩個 text input，對應正反方各自的身分描述。身分需要流向 `DebateState`，再由 state machine 呼叫 `buildPrompt` 時注入 prompt header。

架構邊界：純前端 + Node bridge 單機架構，無遠端後端，persona 僅影響 CLI prompt 文字，不影響 bridge 或 SSE 傳輸層。

## Goals / Non-Goals

**Goals:**

- 將 `perSideCount` 合法上限從 5 提高至 999，所有驗證路徑保持一致。
- 設定彈窗新增 `proPersona`、`conPersona` 文字輸入，預設空字串。
- `lastFormValues` 持久化 payload 含新兩欄位，跨 session 恢復。
- 非空 persona 注入對應方每一回合的 prompt header（宣告行：`你的身分：[身分文字]`），空字串時完全不輸出。

**Non-Goals:**

- 不對 persona 字串做長度或格式限制。
- 不支援辯論中途修改 persona。
- 不調整 codexCli / claudeCli 角色分工與立場的既有耦合方式。
- 不修改 bridge.js 或 SSE 傳輸層。

## Decisions

### 常數集中化：PER_SIDE_MAX 改為 999

`validators.js` 的 `PER_SIDE_MAX` 是對外輸出的唯一來源；`turn-plan.js` 目前有本地複製的 `PER_SIDE_MAX = 5`，需同步改為 999。`state.js` 的 `createInitialDebateState` 亦硬編碼上限檢查 `> 5`，改為 `> 999`。三處同步，不引入共用常數模組（避免額外依賴）。

替代方案：從 `validators.js` 重新匯出常數供 `turn-plan.js` 與 `state.js` 引用 → 會造成循環依賴風險，且這次變更不要求 DRY 重構，捨棄。

### Persona 存放於 DebateState 頂層

`createInitialDebateState` 的 input 新增可選欄位 `proPersona?: string` 與 `conPersona?: string`；缺少或為 undefined 時預設空字串。`DebateState` 物件同步帶入這兩欄位。

替代方案：僅存在 form values，每次 prompt 組裝時從原始 form 讀取 → 增加呼叫方的耦合，且 DebateState 作為單一真相來源的設計會不一致，捨棄。

### buildPrompt 新增可選 persona 參數

`buildPrompt` input 新增 `persona?: string`。呼叫端（`state-machine.js`）依 `turn.stance` 從 `state` 解析出對應 persona（`state.proPersona` 或 `state.conPersona`），再傳入 `buildPrompt`。`buildPrompt` 本身不知道 pro/con，只收一個已解析的字串。

宣告行格式：`你的身分：[身分文字]`，插入位置在 `你的立場：` 行之後、`這是第 N 個 turn` 行之前。

替代方案：直接傳 `{ proPersona, conPersona }` 給 `buildPrompt` 並讓它內部 resolve → `buildPrompt` 承擔了立場解析責任，職責不單一，捨棄。

## Implementation Contract

**行為（對使用者可見）：**
- 設定彈窗顯示 5 個欄位 → 7 個欄位，新增「正方身分」（緊接正方 CLI 後）與「反方身分」（緊接反方 CLI label 後）。
- 每方發言次數輸入框接受 2~999，輸入 1 或 1000 時確定按鈕停用。
- 辯論 prompt 第 3 行（若 persona 非空）出現 `你的身分：[身分文字]`，否則該行不存在。

**介面／資料形狀：**
- `validatePerSideCount(value)`：合法範圍 `2 ≤ value ≤ 999`。
- `createInitialDebateState(input)`：input 新增 `proPersona?: string`、`conPersona?: string`；缺省為 `""`。回傳的 DebateState 新增 `proPersona: string`、`conPersona: string`。
- `buildPrompt(input)`：input 新增 `persona?: string`；非空時 header 含宣告行，空或缺省時不含。
- `lastFormValues` JSON：新增 `proPersona: string`、`conPersona: string` 兩欄位。

**失敗模式：**
- persona 為空字串 → `buildPrompt` 不輸出宣告行，視為正常路徑。
- 舊版 `lastFormValues`（無 persona 欄位）→ `setup.js` 讀取時兩欄位缺省為 `""`，向後相容。

**驗收標準：**
- `tests/validators.test.js`：`validatePerSideCount(999)` 回傳 valid；`validatePerSideCount(1000)` 回傳 invalid。
- `tests/prompt.test.js`：persona 非空時 `buildPrompt` 輸出含 `你的身分：Junior 前端工程師`；persona 為 `""` 時輸出不含 `你的身分：`。
- `tests/state.test.js`（或現有相關測試）：`createInitialDebateState` 傳入 persona 欄位後，回傳 state 含對應值；缺省時兩欄位均為 `""`。

**範圍邊界：**
- 在範圍內：validators.js、turn-plan.js、state.js、setup.js、prompt.js、state-machine.js 及對應測試。
- 在範圍外：bridge.js、exporter.js、timeline.js、persistence.js（除 lastFormValues 結構天然相容外不需額外改動）。

## Risks / Trade-offs

- [風險] `turn-plan.js` 的本地 `PER_SIDE_MAX` 常數若漏改，高發言次數場次會在 buildTurnPlan 拋 Error → 緩解：tasks 中明列此檔案為必改項目。
- [風險] 舊 `lastFormValues` 缺少 persona 欄位 → 緩解：setup.js 讀取時 fallback 至 `""` 已在設計中明定，向後相容。
- [Trade-off] persona 不做字數限制：使用者輸入極長身分描述會撐大 prompt token。接受此風險，本階段不做限制。
