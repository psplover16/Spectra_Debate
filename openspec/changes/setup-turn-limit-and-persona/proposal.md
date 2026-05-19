## Why

目前設定彈窗的每方發言次數上限硬限制為 5，無法支援較長場次的辯論需求。此外，AI 辯手沒有身分設定，無法模擬特定角色觀點，限制了練習與教學用途。

## What Changes

- **每方發言次數上限**：從 5 放寬至 999，下限維持 2 不變。
- **新增正方身分欄位（proPersona）**：文字輸入，位於正方 CLI 選擇後，預設空字串（空 = 不指定身分）。
- **新增反方身分欄位（conPersona）**：文字輸入，位於反方（自動推算的 CLI）欄位後，預設空字串。
- **Prompt 注入**：當身分欄位非空時，於該方每一回合的 prompt header 加入一行身分宣告；空字串時完全不輸出該行。
- **持久化**：`lastFormValues` 的 JSON payload 新增 `proPersona` 與 `conPersona` 兩欄位，跨 session 恢復。

## Non-Goals

- 不支援辯論中途動態修改身分。
- 不對身分欄位內容做任何限制或格式驗證（使用者自由輸入）。
- 不涉及正反方 CLI 的中途互換。
- 不調整 codexCli 與 claudeCli 在場中的預設角色分工（正方 CLI 於開局固定，全場不變）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `debate-setup`：發言次數上限 5 → 999；新增 `proPersona`、`conPersona` 欄位至設定彈窗與 `lastFormValues` 持久化 payload。
- `debate-prompt-context`：新增「身分宣告行」注入行為，僅當對應方 persona 非空時才輸出。

## Impact

- Affected specs:
  - 修改：`openspec/specs/debate-setup/spec.md`
  - 修改：`openspec/specs/debate-prompt-context/spec.md`
- Affected code:
  - Modified: `src/validators.js`
  - Modified: `src/setup.js`
  - Modified: `src/state.js`
  - Modified: `src/prompt.js`
  - Modified: `tests/validators.test.js`
  - Modified: `tests/prompt.test.js`
