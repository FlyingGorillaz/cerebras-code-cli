---
name: speed-prototyping
description: "Rapid iterative prototyping that exploits fast inference for tight feedback loops. Activates on: prototype, spike, POC, proof of concept, try variations, explore approaches, quick experiment, sketch out, rapid iteration, fast feedback."
---

# Speed Prototyping

Exploit low-latency inference for rapid iteration. The core insight: when inference is fast, trying multiple approaches costs less than deliberating about which one to pick.

## Workflow

### 1. Minimal First Pass
Get something running immediately:
- Hardcode values
- Skip error handling
- Inline everything
- No abstractions yet

### 2. Tight Iteration Loop
Change → Run → Observe → Repeat

Each cycle should be seconds, not minutes. Make ONE small change per iteration.

### 3. Branch When Stuck
If approach isn't working after 2-3 attempts, don't debug—try a different approach entirely:

```
## Approach A: [strategy]
[minimal implementation]
→ Result: [worked / failed because X]

## Approach B: [different strategy]
[minimal implementation]
→ Result: [worked / failed because X]

## Winner: Approach [X]
[refined implementation]
```

### 4. Refine Winner Only
Add error handling, types, and abstractions only after confirming the approach works.

## Decision Rules

| Situation | Action |
|-----------|--------|
| Unsure which approach | Try both, don't deliberate |
| Approach failing | Pivot after 2 attempts |
| Working but messy | Keep going, clean later |
| Edge case discovered | Note it, handle after core works |

## Anti-Patterns

- Designing before building
- Adding error handling before happy path works
- Refactoring before shipping
- Deliberating when you could be testing

## Examples

See `examples/fetch-retry.md` for a complete walkthrough of the branch-and-pick workflow.

## Validation

Before finishing, verify the prototype:
1. Run it with expected input → works
2. Run it with edge case → note behavior
3. Confirm the core value proposition is demonstrated
