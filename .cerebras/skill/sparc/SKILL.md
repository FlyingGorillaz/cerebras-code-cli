---
name: sparc
description: Use for ANY complex feature, refactor, or multi-step development task. SPARC walks through Specification, Pseudocode, Architecture, Refinement, and Completion — a structured methodology that turns vague requests into solid implementations. Triggers on keywords like build, implement, create, design, refactor, add feature, architect, plan and build, or any task that benefits from thinking before coding.
---

Systematic development methodology: **Specification, Pseudocode, Architecture, Refinement, Completion**. Each phase produces a concrete artifact before moving to the next. Cerebras inference speed makes this feel instant — you get the rigor of structured engineering without the wait.

The user provides a feature request, bug description, or development task. It may be vague or detailed.

## Phase 1: Specification

Before touching code, define what you're building:

- **Problem**: What exactly needs to change? What's broken or missing?
- **Constraints**: What can't change? Performance requirements? Backwards compatibility?
- **Success criteria**: How do we know it's done? What should a reviewer see?
- **Scope boundary**: What is explicitly NOT part of this task?

Output a brief spec (5-10 lines). If requirements are ambiguous, ask the user before proceeding.

## Phase 2: Pseudocode

Think through the logic in plain language before writing real code:

- Outline the control flow, data transformations, and edge cases
- Identify the key functions/components and their signatures
- Note where existing code will be touched vs new code created
- Flag any risky areas (concurrency, error handling, migrations)

Keep it short — pseudocode is a thinking tool, not documentation. Use numbered steps or bullet points, not full syntax.

## Phase 3: Architecture

Map the pseudocode onto the actual codebase:

- **Read first**: Examine the files you'll modify. Understand existing patterns before proposing new ones.
- **File plan**: List each file to create or modify, with a one-line summary of the change
- **Interface contracts**: Define function signatures, types, or API shapes that connect components
- **Dependencies**: What does this touch? What could break?

Follow existing conventions. Don't introduce new patterns unless the existing ones are clearly wrong for this use case.

## Phase 4: Refinement (TDD)

Implement with a test-first approach:

1. **Write a failing test** that captures the core behavior from your spec
2. **Write the minimum code** to make it pass — no more
3. **Run the test** to confirm it passes
4. **Refactor** if the code is unclear, but don't add features
5. **Repeat** for the next behavior

If the project doesn't have a test framework set up, skip to direct implementation but still work incrementally — one function at a time, verifying each before moving on.

## Phase 5: Completion

Wrap up with confidence:

- Run the full test suite (not just your new tests)
- Check for regressions in related functionality
- Remove any temporary code, debug logs, or commented-out blocks
- Verify the original success criteria from Phase 1 are met

If anything fails, loop back to the relevant phase rather than patching blindly.

## How to Use This

Don't announce each phase — just follow the progression naturally. For small tasks, phases collapse (a 3-line fix doesn't need pseudocode). For large tasks, each phase should produce visible output the user can react to before you continue.

The value is thinking before coding. Cerebras makes the thinking fast enough that it doesn't feel like overhead.
