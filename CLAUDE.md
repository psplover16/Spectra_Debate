<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `/spectra-*` skills when:

- A discussion needs structure before coding → `/spectra-discuss`
- User wants to plan, propose, or design a change → `/spectra-propose`
- Tasks are ready to implement → `/spectra-apply`
- There's an in-progress change to continue → `/spectra-ingest`
- User asks about specs or how something works → `/spectra-ask`
- Implementation is done → `/spectra-archive`
- Commit only files related to a specific change → `/spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

## 一般行為準則
- 變更前一律先說明計畫。
- 每完成一個有意義的步驟就回報進度。
- 結束前彙整變更的檔案與測試結果。
- 以繁體中文回覆。
- 所有新增或修改的中文內容（包含 commit message、規格文件與對外說明）都必須以 UTF-8 正確保存與提交，不得出現亂碼、問號替代字元，或讓 BOM 汙染可見文字。

<!-- ## 規格工作流程 -->

## 檔案存取限制
- 不得讀取或修改 `_private/_private_notes/筆記.txt`。
- 除非明確要求，否則忽略個人筆記與學習資料。
- 受限版本資料夾名稱：`done`。
<!-- - 受限版本資料夾名稱：`done`、`v11`。 -->
- 在 `_private/_private_notes/` 內，凡是名稱符合受限版本資料夾名稱的資料夾，及其底下任何檔案（不論巢狀深度），皆不得讀取或修改。
- 在 `_private/_private_fileAssets/` 內，凡是名稱符合受限版本資料夾名稱的資料夾，及其底下任何檔案（不論巢狀深度），皆不得讀取或修改。
