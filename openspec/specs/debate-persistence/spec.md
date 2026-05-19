# debate-persistence Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: DebateState Persists to localStorage After Each Turn Completes

The frontend SHALL serialize the current DebateState as JSON and write it to localStorage key `spectra-debate:current` whenever a turn transitions from status `streaming` to status `done` or status `failed`. The frontend SHALL NOT write to this key during character-by-character streaming chunk receipt.

#### Scenario: Turn completion triggers single persist

- **WHEN** turn 2 transitions from `streaming` to `done`
- **THEN** exactly one write to localStorage key `spectra-debate:current` occurs at that transition

#### Scenario: Streaming chunks do not persist

- **WHEN** turn 3 is in status `streaming` and the frontend receives 10 chunk events
- **THEN** no writes to localStorage key `spectra-debate:current` occur during chunk receipt

---
### Requirement: Last Form Values Persist Separately From Debate State

The frontend SHALL write the most recent successful setup popup submission to localStorage key `spectra-debate:lastFormValues` containing fields topic, proSide, perSideCount, firstSpeakerStance, and effortLevel. This key MUST be stored independently of `spectra-debate:current`.

#### Scenario: Popup submission writes lastFormValues independently

- **WHEN** the user confirms the setup popup with valid values
- **THEN** localStorage key `spectra-debate:lastFormValues` is written with the submitted values
- **AND** the write to `lastFormValues` is performed independently of any write to `spectra-debate:current`

---
### Requirement: Single Slot Only With No Historical Debate Storage

The frontend SHALL keep at most one debate state in localStorage at any time. Starting a new debate by confirming the setup popup SHALL overwrite the existing value at key `spectra-debate:current`. The frontend SHALL NOT use additional storage keys for prior debates.

#### Scenario: New debate overwrites existing

- **WHEN** the user confirms the popup and starts a new debate while localStorage contains a previous DebateState at key `spectra-debate:current`
- **THEN** the previous DebateState is replaced by a new initial DebateState at the same key

---
### Requirement: Page Load Routes the User Based on Persisted State

On page load the frontend SHALL read localStorage key `spectra-debate:current` and route the user according to its content. If the parsed state contains a present `endedAt` field, the ended screen SHALL display the persisted timeline. If the parsed state contains a non-empty `turns` array and no `endedAt`, the ended screen SHALL display with an explicit interrupted-state indicator and SHALL NOT auto-spawn any CLI subprocess. If localStorage does not contain key `spectra-debate:current`, the setup popup SHALL display.

#### Scenario: Ended debate shows ended screen on reload

- **WHEN** the page loads with localStorage key `spectra-debate:current` containing a parsed state whose `endedAt` field is present
- **THEN** the ended screen renders with the persisted turn timeline visible

#### Scenario: Interrupted debate shows interrupted indicator without auto-resume

- **WHEN** the page loads with localStorage key `spectra-debate:current` containing a parsed state whose `turns` array is non-empty and whose `endedAt` field is absent
- **THEN** the ended screen renders with an interrupted-state indicator
- **AND** no CLI subprocess is spawned automatically

#### Scenario: Empty state shows setup popup

- **WHEN** the page loads with no value at localStorage key `spectra-debate:current`
- **THEN** the setup popup is displayed
