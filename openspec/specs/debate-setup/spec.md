# debate-setup Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: Debate Setup Popup Appears Before Each Debate

The system SHALL display a setup popup before any debate begins, requiring the user to provide a debate topic, stance assignment for codex versus claude, per-side turn count, first speaker selection, and reasoning effort level. The debate SHALL NOT start until all fields pass validation and the user confirms.

#### Scenario: First-time visitor sees empty popup

- **WHEN** a user opens the application with no prior `spectra-debate:lastFormValues` in localStorage
- **THEN** the popup appears with topic empty, pro side set to codex, perSideCount set to 3, first speaker set to pro, and effort level set to medium
- **AND** the confirm button is disabled until the topic field passes validation

#### Scenario: Returning visitor sees pre-filled popup

- **WHEN** a user opens the application and `spectra-debate:lastFormValues` exists in localStorage
- **THEN** the popup appears with all five fields pre-filled from the stored values

---
### Requirement: Topic Validation Enforces Length Bounds

The system SHALL trim the topic input and require its length to be between 4 and 100 characters inclusive. The confirm button MUST remain disabled until the topic passes this rule.

#### Scenario: Topic too short rejected

- **WHEN** the user types a topic whose trimmed length is 3 characters or fewer
- **THEN** the confirm button is disabled
- **AND** a validation hint indicating minimum length 4 appears

#### Scenario: Topic too long rejected

- **WHEN** the user types a topic whose trimmed length is 101 characters or more
- **THEN** the confirm button is disabled
- **AND** a validation hint indicating maximum length 100 appears

##### Example: boundary cases

| Trimmed length | Confirm button |
| -------------- | -------------- |
| 3              | disabled       |
| 4              | enabled        |
| 100            | enabled        |
| 101            | disabled       |

---
### Requirement: Per-Side Turn Count Constrained to 2 Through 5 Inclusive

The system SHALL constrain the per-side turn count to integer values 2, 3, 4, or 5. The default value SHALL be 3. The system MUST reject inputs outside this range by keeping the confirm button disabled.

#### Scenario: Out-of-range turn count rejected

- **WHEN** the user attempts to set perSideCount to 1 or 6
- **THEN** the confirm button is disabled
- **AND** the input control prevents submission of out-of-range values

---
### Requirement: Form Values Persist Across Sessions

The system SHALL store the most recent successful form input to localStorage key `spectra-debate:lastFormValues` whenever the user confirms a new debate. The stored payload SHALL contain topic, pro side CLI name, perSideCount, first speaker stance, and effort level. On subsequent popup display, the stored values SHALL be loaded as defaults.

#### Scenario: Successful confirm writes lastFormValues

- **WHEN** the user confirms the popup with values topic="Q", proSide="claude", perSideCount=4, firstSpeakerStance="con", effortLevel="high"
- **THEN** localStorage key `spectra-debate:lastFormValues` contains a JSON object with those exact five fields

#### Scenario: Page reload reads lastFormValues

- **WHEN** the page reloads and the popup re-displays after a previous confirm
- **THEN** the popup pre-fills all five fields with the values written by the previous confirm
