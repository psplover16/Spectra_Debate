# debate-message-timeline Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: Messages Render in Vertical Time-Ordered Timeline

The frontend SHALL display debate turns as message cards stacked vertically in chronological order. The frontend SHALL NOT use a left-right split layout for pro versus con messages.

#### Scenario: Turns appear in chronological order

- **WHEN** turns 1, 2, and 3 complete sequentially with content "A", "B", "C"
- **THEN** the rendered timeline displays a card containing "A" at the top, then a card containing "B" below it, then a card containing "C" below that

---
### Requirement: Pro and Con Use Distinct Color Schemes

The frontend SHALL render pro-stance messages using a blue color scheme and con-stance messages using a red color scheme. The color scheme SHALL apply to at least the message card border and the chip header background.

#### Scenario: Pro turn rendered with blue color scheme

- **WHEN** a turn with stance `pro` renders
- **THEN** the message card border uses a blue hue
- **AND** the chip header background uses a blue hue

#### Scenario: Con turn rendered with red color scheme

- **WHEN** a turn with stance `con` renders
- **THEN** the message card border uses a red hue
- **AND** the chip header background uses a red hue

---
### Requirement: Each Message Card Has a Chip Header Identifying Stance and CLI

Each message card SHALL display a chip header in its upper-left area containing the localized stance label (literal `正方` for pro, literal `反方` for con) and the CLI name. A timestamp SHALL appear in the upper-right area of the card. The message content SHALL be in a separate paragraph below the chip.

#### Scenario: Chip header content for pro codex turn

- **WHEN** a turn with stance `pro` and cli `codex` renders
- **THEN** the chip header text contains the literal string `正方` and the literal string `codex`

#### Scenario: Chip header content for con claude turn

- **WHEN** a turn with stance `con` and cli `claude` renders
- **THEN** the chip header text contains the literal string `反方` and the literal string `claude`

---
### Requirement: Streaming Content Renders Incrementally

The frontend SHALL append each SSE chunk to the active turn's message card content immediately upon receipt. The frontend SHALL NOT buffer the full response before showing content.

#### Scenario: Chunks render incrementally

- **WHEN** the bridge emits three chunk events with payload values "Hello", " ", "World"
- **THEN** the message card displays "Hello" after the first event
- **AND** displays "Hello " after the second event
- **AND** displays "Hello World" after the third event

---
### Requirement: Failed Turns Render as Distinct Warning Cards

The frontend SHALL render turns with status `failed` using a gray background and a warning marker. The chip header for failed turns SHALL still display stance label and CLI name. The errorMessage SHALL appear in the card body.

#### Scenario: Failed turn shown with warning marker

- **WHEN** turn 3 has status `failed` with errorMessage "CLI timeout (90 seconds elapsed)"
- **THEN** the corresponding message card uses a gray background
- **AND** displays a warning marker
- **AND** displays the text "CLI timeout (90 seconds elapsed)" in the card body

---
### Requirement: Closing Turns Are Marked in the Chip Header

The frontend SHALL append a closing marker to the chip header text for turns with `kind` equal to `closing`. The marker SHALL be visually distinct from the chip text of debate turns.

#### Scenario: Closing turn chip differs from debate turn chip

- **WHEN** turn 7 with stance `pro`, cli `codex`, and kind `closing` renders
- **THEN** the chip header text contains the literal `正方`, the literal `codex`, and an additional marker that does not appear on chips for turns with kind `debate`
