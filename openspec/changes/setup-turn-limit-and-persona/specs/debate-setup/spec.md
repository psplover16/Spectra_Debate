## MODIFIED Requirements

### Requirement: Per-Side Turn Count Constrained to 2 Through 999 Inclusive

The system SHALL constrain the per-side turn count to integer values between 2 and 999 inclusive. The default value SHALL be 3. The system MUST reject inputs outside this range by keeping the confirm button disabled.

#### Scenario: Out-of-range turn count rejected

- **WHEN** the user attempts to set perSideCount to 1 or 1000
- **THEN** the confirm button is disabled
- **AND** the input control prevents submission of out-of-range values

##### Example: boundary cases

| perSideCount | Confirm button |
| ------------ | -------------- |
| 1            | disabled       |
| 2            | enabled        |
| 999          | enabled        |
| 1000         | disabled       |

---

### Requirement: Form Values Persist Across Sessions

The system SHALL store the most recent successful form input to localStorage key `spectra-debate:lastFormValues` whenever the user confirms a new debate. The stored payload SHALL contain topic, pro side CLI name, perSideCount, first speaker stance, effort level, proPersona, and conPersona. On subsequent popup display, the stored values SHALL be loaded as defaults.

#### Scenario: Successful confirm writes lastFormValues

- **WHEN** the user confirms the popup with values topic="Q", proSide="claude", perSideCount=4, firstSpeakerStance="con", effortLevel="high", proPersona="資深法官", conPersona=""
- **THEN** localStorage key `spectra-debate:lastFormValues` contains a JSON object with those exact seven fields

#### Scenario: Page reload reads lastFormValues

- **WHEN** the page reloads and the popup re-displays after a previous confirm
- **THEN** the popup pre-fills all seven fields with the values written by the previous confirm

#### Scenario: Legacy lastFormValues without persona fields loads with empty persona defaults

- **WHEN** `spectra-debate:lastFormValues` exists in localStorage but does not contain `proPersona` or `conPersona`
- **THEN** the popup displays with proPersona and conPersona both set to empty string

## ADDED Requirements

### Requirement: Each Side May Optionally Specify an AI Persona

The system SHALL provide a text input for each side (pro and con) allowing the user to assign a persona to the AI debater for that side. Each persona field SHALL appear immediately after its corresponding side's CLI selector in the setup form. An empty persona value SHALL be valid and SHALL mean no persona is assigned. The default value for both persona fields SHALL be empty string. The persona value SHALL be included in the stored `lastFormValues` payload and restored on subsequent popup displays.

#### Scenario: Pro side persona specified

- **WHEN** the user enters "Junior 前端工程師" in the pro persona field and confirms
- **THEN** the stored `lastFormValues` contains `proPersona: "Junior 前端工程師"`
- **AND** the prompt for every pro-side turn includes a line declaring that persona

#### Scenario: No persona specified (default)

- **WHEN** the user leaves both persona fields empty and confirms
- **THEN** the stored `lastFormValues` contains `proPersona: ""` and `conPersona: ""`
- **AND** no persona declaration line appears in any turn's prompt

#### Scenario: Con side persona independent of pro side

- **WHEN** the user enters "高中生" in the con persona field and leaves the pro persona field empty
- **THEN** the stored `lastFormValues` contains `proPersona: ""` and `conPersona: "高中生"`
- **AND** only con-side turn prompts contain a persona declaration line
