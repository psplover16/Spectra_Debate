## ADDED Requirements

### Requirement: Persona Declaration Injected Into Prompt Header When Assigned

When a non-empty persona is assigned to a side, the bridge SHALL include a persona declaration line in the prompt header for every turn belonging to that side. The declaration line SHALL use the format `你的身分：[persona text]`. The declaration SHALL appear after the stance line and before the turn index line. When the persona is empty string, the declaration line SHALL be omitted entirely.

#### Scenario: Persona present in pro-side prompt

- **WHEN** a pro-side turn's prompt is constructed and the pro persona is "Junior 前端工程師"
- **THEN** the prompt header contains the line `你的身分：Junior 前端工程師`
- **AND** the line appears after the stance line and before the turn index line

#### Scenario: No persona — declaration line absent

- **WHEN** a turn's prompt is constructed and the corresponding side's persona is empty string
- **THEN** the prompt header does NOT contain any line beginning with `你的身分：`

#### Scenario: Con persona does not appear in pro-side prompt

- **WHEN** a pro-side turn's prompt is constructed and proPersona is "" and conPersona is "高中生"
- **THEN** the prompt header does NOT contain any line beginning with `你的身分：`
