---
name: speed-prototyping
description: "Rapid iterative prototyping that leverages Cerebras's fast inference. Use for quickly building, testing, and refining code through multiple fast iterations. Triggers on: prototype, iterate, rapid, quick, fast build, try variations, explore options, spike, proof of concept, POC, sketch out, rough draft."
---

# Speed Prototyping

Leverage Cerebras's blazing-fast inference for rapid iterative development. This skill excels at quickly exploring multiple approaches, refining implementations through fast feedback loops, and building working prototypes in record time.

## When to Use

- Building proof-of-concept implementations
- Exploring multiple solution approaches quickly
- Rapid iteration on features or components
- Spiking technical solutions before committing
- Quick experimentation with APIs or libraries

## Prototyping Workflow

### Phase 1: Quick Sketch (30 seconds)
Start with the simplest possible working version:
- Hardcode values where possible
- Skip error handling initially
- Use inline implementations over abstractions
- Get something running immediately

### Phase 2: Rapid Iteration (multiple fast cycles)
With Cerebras's speed, iterate aggressively:
- Make small, focused changes
- Test after each change
- Try multiple approaches in parallel
- Keep what works, discard what doesn't

### Phase 3: Refine Winner
Once a working approach emerges:
- Add proper error handling
- Extract reusable pieces
- Add types and validation
- Clean up hardcoded values

## Iteration Strategies

### Try Multiple Approaches
When uncertain, generate 2-3 variations quickly:
```
Approach A: Simple imperative
Approach B: Functional composition  
Approach C: Object-oriented
→ Test each, pick the winner
```

### Fast Feedback Loops
Use the speed advantage for tight loops:
1. Change → Test → 2 seconds
2. Adjust → Test → 2 seconds
3. Refine → Test → 2 seconds

### Parallel Exploration
Explore options simultaneously rather than sequentially:
- Test multiple API endpoints at once
- Try different data structures in parallel
- Compare multiple library approaches

## Prototyping Best Practices

### Speed Over Perfection
- Working code beats perfect code
- Comments can wait
- Optimization comes later
- Ship the prototype, refine the product

### Fail Fast
- If an approach isn't working after 2-3 iterations, pivot
- Don't sink time into dead ends
- Cerebras speed means trying alternatives is cheap

### Keep Evidence
- Note what worked and what didn't
- Keep failed attempts commented briefly
- Document the winning approach

## Output Format

When prototyping, structure output as:

```
## Attempt 1: [Approach Name]
[Code]
Result: [What happened]

## Attempt 2: [Approach Name]  
[Code]
Result: [What happened]

## Winner: [Best Approach]
[Final refined code]
Why: [Brief explanation]
```

## Speed Tips

1. **Use Cerebras's speed**: Don't hesitate to regenerate, retry, or explore
2. **Small changes**: Iterate in small increments for fast feedback
3. **Parallel when possible**: Test multiple ideas simultaneously
4. **Move fast**: The goal is working code, not perfect code
5. **Trust the iteration**: Each cycle gets you closer to the solution
