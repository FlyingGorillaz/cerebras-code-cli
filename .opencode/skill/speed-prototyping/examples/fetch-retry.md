# Example: Fetch with Retry

User request: "add retry logic to this fetch call"

## Approach A: setTimeout recursion

```typescript
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok && attempts > 1) {
    await new Promise(r => setTimeout(r, 1000))
    return fetchWithRetry(url, attempts - 1)
  }
  return res
}
```

→ Result: Works, but delay is hardcoded

## Approach B: for-loop with exponential backoff

```typescript
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url)
    if (res.ok) return res
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
  }
  throw new Error(`Failed after ${maxAttempts} attempts`)
}
```

→ Result: Works, cleaner control flow, proper error on exhaustion

## Winner: Approach B

Chose B because:
- Explicit failure after retries exhausted
- Exponential backoff built-in
- Easier to add jitter later if needed
