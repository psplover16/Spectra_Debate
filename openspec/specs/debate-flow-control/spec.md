# debate-flow-control Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: Turn Order Is Determined by First Speaker Selection

The system SHALL alternate stances between pro and con beginning with the user-selected first speaker. The total number of debate turns SHALL equal `2 * perSideCount` followed by exactly 2 closing turns. The two closing turns SHALL follow the same alternation pattern as the main debate.

#### Scenario: Pro speaks first with perSideCount 3

- **WHEN** the debate runs to completion with firstSpeakerStance `pro` and perSideCount 3
- **THEN** the turn stance sequence equals: pro, con, pro, con, pro, con, pro, con
- **AND** the turn kind sequence equals: debate, debate, debate, debate, debate, debate, closing, closing

#### Scenario: Con speaks first with perSideCount 2

- **WHEN** the debate runs to completion with firstSpeakerStance `con` and perSideCount 2
- **THEN** the turn stance sequence equals: con, pro, con, pro, con, pro
- **AND** the turn kind sequence equals: debate, debate, debate, debate, closing, closing

---
### Requirement: Automatic Advancement After Each Turn Completes

The system SHALL automatically advance to the next turn when the current turn reaches status `done` or `failed`. The advancement SHALL be triggered by an internal next-turn event and SHALL NOT require user input. The next-turn handoff SHALL NOT be exposed as a clickable UI button.

#### Scenario: Done turn triggers advancement

- **WHEN** turn k completes with status `done` and k is not the final turn
- **THEN** turn k+1 starts automatically without user interaction

#### Scenario: Failed turn triggers advancement

- **WHEN** turn k completes with status `failed` and k is not the final turn
- **THEN** turn k+1 starts automatically

---
### Requirement: Terminate Button Is the Only User Flow Control During Running Debate

The system SHALL present exactly one user-clickable flow control during a running debate: a terminate button. The button SHALL end the debate permanently when pressed. The system SHALL NOT present a pause, resume, manual next-turn, or skip-turn button to the user.

#### Scenario: Terminate ends debate immediately

- **WHEN** the user clicks the terminate button while turn k is running
- **THEN** the running CLI subprocess is aborted via the bridge abort endpoint
- **AND** the debate state transitions to ended with endReason `terminated`
- **AND** no further turns are spawned

---
### Requirement: CLI Failure or Timeout Skips the Turn Without Terminating the Debate

The system SHALL mark a turn as `failed` when the bridge emits an error event for that turn. Failure causes include timeout, non-zero exit code, empty output, and subprocess spawn error. The system SHALL NOT retry the failed turn, SHALL NOT prompt the user, and SHALL NOT end the debate prematurely. The system SHALL advance to the next turn following the normal alternation pattern.

#### Scenario: Timeout failure skips turn and continues

- **WHEN** turn 3 fails due to 90-second timeout
- **THEN** turn 3 is recorded with status `failed` and errorMessage that identifies timeout
- **AND** turn 4 begins automatically

##### Example: failure mode catalogue

| Trigger              | turn.status | errorMessage prefix          |
| -------------------- | ----------- | ---------------------------- |
| 90 second timeout    | failed      | CLI timeout                  |
| Non-zero exit code   | failed      | CLI exited with code         |
| Empty output         | failed      | CLI returned empty content   |
| spawn error          | failed      | Failed to start CLI          |
| User terminated mid  | failed      | Terminated by user           |

---
### Requirement: Last Two Turns Are Always Closing Turns

The system SHALL designate the last two turns of every debate as closing turns with `kind` equal to `closing`. All preceding turns SHALL have `kind` equal to `debate`. The closing turns SHALL use the closing prompt variant defined by the `debate-prompt-context` capability.

#### Scenario: Final two turns marked closing with perSideCount 3

- **WHEN** a debate with perSideCount 3 runs to completion producing 8 total turns
- **THEN** turns 1 through 6 have `kind` equal to `debate`
- **AND** turns 7 and 8 have `kind` equal to `closing`
