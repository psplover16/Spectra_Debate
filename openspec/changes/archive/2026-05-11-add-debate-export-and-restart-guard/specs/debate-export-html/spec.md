## ADDED Requirements

### Requirement: Ended Screen Displays Export HTML Button

The frontend SHALL display an "export HTML" button on the ended screen alongside the restart button. The button SHALL be visible regardless of whether the debate ended by completion, user termination, or interruption.

#### Scenario: Export button visible after normal completion

- **WHEN** a debate finishes with `endReason: 'completed'` and the ended screen renders
- **THEN** the screen displays both a restart button and an export button

#### Scenario: Export button visible after user termination

- **WHEN** a debate ends because the user clicked terminate
- **THEN** the ended screen still displays the export button

### Requirement: Clicking Export Triggers Browser Download

When the export button is clicked, the frontend SHALL build a self-contained HTML document and trigger a browser download via Blob URL.

#### Scenario: Click triggers anchor download

- **WHEN** the user clicks the export button on the ended screen
- **THEN** the frontend creates a Blob with content type `text/html;charset=utf-8`
- **AND** triggers a download via a temporary `<a download>` element
- **AND** revokes the Blob URL after the download is dispatched

### Requirement: Export Filename Uses Debate Start Time

The export filename SHALL be `debate-YYYYMMDD-HHMM.html` where the date/time is derived from `DebateState.startedAt` interpreted in the user's local time zone. If `startedAt` cannot be parsed, the filename SHALL fall back to the current time without throwing.

#### Scenario: Filename derived from startedAt

- **WHEN** the debate started at a known local time and the user exports
- **THEN** the download filename matches the pattern `debate-\d{8}-\d{4}\.html`

#### Scenario: Invalid startedAt falls back gracefully

- **WHEN** `startedAt` is missing or not a valid ISO string
- **THEN** the filename still matches the pattern `debate-\d{8}-\d{4}\.html` using the current time

### Requirement: Exported HTML Is Single Self-Contained Document

The exported HTML SHALL embed all required CSS inline within a `<style>` element. The document SHALL NOT contain any external `<link rel="stylesheet">`, `<script>` element, or remote resource reference. The file SHALL be openable by double-click without network access.

#### Scenario: No external links in export

- **WHEN** the exported HTML is inspected
- **THEN** the document contains exactly one `<style>` block with the embedded CSS
- **AND** contains no `<link>` element pointing to a stylesheet
- **AND** contains no `<script>` element

### Requirement: Exported HTML Contains Topic and Metadata Header

The exported HTML SHALL include the debate topic as an `<h1>`, plus a metadata paragraph naming the pro CLI, con CLI, perSideCount, first speaker stance, effort level, start time, end time, end reason, and failed turn count.

#### Scenario: Header content for a completed debate

- **WHEN** the export is generated for a debate with topic "T", proSide "codex", perSideCount 3, firstSpeakerStance "pro", effortLevel "medium", endReason "completed"
- **THEN** the document contains an `<h1>` with text "T"
- **AND** the metadata paragraph contains the literal strings "正方：codex", "反方：claude", "N=3", "首發：正方", "推理能力：medium", and "正常完成"

#### Scenario: User-terminated debate is labeled accordingly

- **WHEN** the export is generated for a debate with `endReason: 'terminated'`
- **THEN** the metadata paragraph contains the literal string "使用者終止"

### Requirement: Exported HTML Renders All Turns Including Failed Ones

The exported HTML SHALL render every turn in `state.turns` using the same message card structure as the live timeline. Failed turns SHALL render as gray warning cards with their `errorMessage` shown in the content area; their stance and CLI chip headers SHALL still be present.

#### Scenario: All turns appear in chronological order

- **WHEN** the export is generated for a debate with 6 completed turns
- **THEN** the document contains 6 `<article class="turn-card">` elements in turn-index order

#### Scenario: Failed turn placeholder shown

- **WHEN** a debate has turn 2 with `status: 'failed'` and `errorMessage: 'CLI timeout (90s)'`
- **THEN** the exported HTML for turn 2 contains the `turn-card--failed` class
- **AND** contains the literal string "CLI timeout (90s)"
- **AND** still contains the chip header with stance label and CLI name

### Requirement: Closing Turns Marked Distinctly in Export

Exported turns with `kind: 'closing'` SHALL include both a closing marker in their chip text and the `turn-card--closing` CSS class, matching the live timeline rendering.

#### Scenario: Closing turn chip differs

- **WHEN** the export is generated for a debate with closing turns
- **THEN** the chip text for closing turns contains the literal string "結辯"
- **AND** those cards carry the class `turn-card--closing`

### Requirement: HTML Special Characters Are Escaped in Topic and Metadata

The exporter SHALL escape the five HTML special characters (`&`, `<`, `>`, `"`, `'`) in any topic or metadata string written into the document, preventing HTML injection from user-supplied input.

#### Scenario: Topic containing script tag is rendered as text

- **WHEN** the user-supplied topic is `<script>alert(1)</script>` and the export is generated
- **THEN** the document does NOT contain an executable `<script>` element from the topic
- **AND** the document contains the escaped literal `&lt;script&gt;`

### Requirement: Successful Export Updates DebateState.exported to True

After a successful export, the frontend SHALL set `DebateState.exported` to `true` and persist the updated state to localStorage. The export button SHALL update its label to indicate the export occurred and SHALL remain clickable (re-export allowed).

#### Scenario: Export updates flag and persists

- **WHEN** the export button is clicked and the download succeeds
- **THEN** `state.exported` becomes `true`
- **AND** `localStorage.spectra-debate:current` is updated to include `exported: true`
- **AND** the export button label changes to indicate the export completed (containing either "已匯出" or the filename)

#### Scenario: Re-export is allowed

- **WHEN** the export button is clicked twice in succession
- **THEN** the download is triggered twice
- **AND** `state.exported` remains `true`
