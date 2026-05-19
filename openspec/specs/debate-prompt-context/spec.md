# debate-prompt-context Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: Each Turn Prompt Embeds the Full Prior Debate History

The bridge SHALL construct each turn's prompt to include all prior turns of the current debate (turn indices 1 through k-1) in chronological order. Each historical turn SHALL be rendered as a single block containing the stance label, the CLI name, and the turn content.

#### Scenario: Turn 4 prompt includes turns 1 through 3 content

- **WHEN** the prompt for turn 4 is constructed in a debate where turns 1, 2, and 3 have completed with contents C1, C2, C3
- **THEN** the constructed prompt text contains the literal C1 string
- **AND** contains the literal C2 string
- **AND** contains the literal C3 string in chronological order

---
### Requirement: Failed Turns Appear in History as Explicit Placeholders

When constructing prompt history, the bridge SHALL render any prior turn with status `failed` as a placeholder line containing the stance label, CLI name, and an explicit failure marker. The placeholder format SHALL be distinct from the format used for completed turns.

#### Scenario: Failed prior turn becomes placeholder

- **WHEN** the prompt for turn 3 is constructed and turn 2 has status `failed`
- **THEN** the rendered history block for turn 2 contains a failure marker
- **AND** does not contain any partial content from the failed CLI

---
### Requirement: Main Debate Prompt Requires Direct Rebuttal and Non-Contradiction

The bridge SHALL use a main-debate prompt variant for all turns with `kind` equal to `debate`. The variant SHALL explicitly instruct the CLI to address the opponent's most recent statement, to remain consistent with prior statements of the same stance, and to avoid contradicting earlier positions.

#### Scenario: Debate prompt body contains rebuttal and consistency instructions

- **WHEN** a turn with kind `debate` has its prompt constructed
- **THEN** the prompt body contains an explicit instruction to respond to the opponent's most recent statement
- **AND** contains an explicit instruction against self-contradiction with prior statements of the same stance

---
### Requirement: Closing Prompt Requires Summary and Rebuttal Without New Arguments

The bridge SHALL use a closing prompt variant for turns with `kind` equal to `closing`. The variant SHALL instruct the CLI to summarize the same-stance arguments raised earlier and to rebut the most important opposing arguments. The variant SHALL explicitly forbid introducing brand-new lines of argument.

#### Scenario: Closing prompt body contains summary, rebuttal, and prohibition

- **WHEN** a turn with kind `closing` has its prompt constructed
- **THEN** the prompt body contains an explicit instruction to summarize
- **AND** contains an explicit instruction to rebut
- **AND** contains an explicit prohibition against introducing new lines of argument

---
### Requirement: Prompt Header Identifies Topic, Stance, Turn Index, Total Turn Count, and Kind

Every prompt SHALL begin with header lines naming the debate topic, the CLI's assigned stance for the current turn, the 1-based current turn index, the total turn count for the debate, and the turn kind label.

#### Scenario: Header content present in every prompt

- **WHEN** any turn's prompt is constructed
- **THEN** the prompt text contains the literal topic string supplied by the user
- **AND** contains the localized stance label for the current turn
- **AND** contains the literal turn index as a decimal integer
- **AND** contains the literal total turn count as a decimal integer
- **AND** contains the kind label (either debate or closing)
