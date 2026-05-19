# debate-restart-guard Specification

## Purpose

TBD - created by archiving change 'add-debate-export-and-restart-guard'. Update Purpose after archive.

## Requirements

### Requirement: Restart Button Triggers Confirmation Dialog When Debate Is Not Yet Exported

When the user clicks the restart button on the ended screen and `DebateState.exported` is `false`, the frontend SHALL display a confirmation dialog before discarding the current debate state. The dialog SHALL offer exactly three options: export-then-restart, restart without export, and cancel.

#### Scenario: Unexported state prompts confirmation

- **WHEN** the user clicks restart and `state.exported` is `false`
- **THEN** a confirmation dialog appears with three distinct buttons
- **AND** the existing debate state is not yet overwritten

#### Scenario: Already-exported state skips the dialog

- **WHEN** the user clicks restart and `state.exported` is `true`
- **THEN** no confirmation dialog appears
- **AND** the setup popup displays directly

---
### Requirement: Cancel Option Leaves the Ended Screen Unchanged

The cancel option in the confirmation dialog SHALL dismiss the dialog without restarting and without modifying any state.

#### Scenario: Cancel restores ended screen

- **WHEN** the user clicks the cancel option in the confirmation dialog
- **THEN** the dialog is removed from the DOM
- **AND** the ended screen remains visible with all message cards still displayed
- **AND** `state.exported` is unchanged
- **AND** localStorage `spectra-debate:current` is unchanged

---
### Requirement: Export-Then-Restart Option Performs Both Actions

The export-then-restart option SHALL first trigger the same export action as the export button, then proceed to restart (returning the user to the setup popup).

#### Scenario: Export-then-restart triggers download then setup popup

- **WHEN** the user clicks the export-then-restart option
- **THEN** the browser receives a download for the exported HTML
- **AND** `state.exported` becomes `true` before the restart proceeds
- **AND** the setup popup displays after the dialog closes

---
### Requirement: Restart-Now Option Discards Unexported State Without Prompting Again

The restart-now option SHALL proceed directly to the setup popup without exporting. The previous debate state SHALL be overwritten on next setup confirmation.

#### Scenario: Restart-now skips export and proceeds

- **WHEN** the user clicks the restart-now option
- **THEN** no download is triggered
- **AND** the setup popup displays
- **AND** the existing `state.exported` value is left as `false` until the next setup popup confirmation overwrites the state

---
### Requirement: Confirmation Dialog Is Modal and Blocks Background Interaction

The confirmation dialog SHALL render an overlay covering the entire viewport, preventing clicks on background elements until a dialog button is pressed.

#### Scenario: Background elements not clickable while dialog open

- **WHEN** the confirmation dialog is visible
- **THEN** the overlay element covers the viewport with a non-transparent background
- **AND** clicks on the ended screen behind the overlay are intercepted by the overlay
