---
name: frontend-dev
description: Generate modern, beautiful UI components using React, Next.js, Tailwind CSS, and shadcn/ui following v0-style best practices
---

## When to Use This Skill

Use this skill when:
- Building React/Next.js UI components, pages, or layouts
- Creating modern, responsive interfaces
- Generating shadcn/ui-style components
- Designing forms, dashboards, cards, or other UI elements

## Tech Stack

- **React** with TypeScript
- **Next.js 16** App Router (default)
- **Tailwind CSS v4** for styling
- **shadcn/ui** component patterns
- **Lucide React** for icons
- **Radix UI** primitives

## File Naming & Structure

- Prefer kebab-case for file names: `login-form.tsx`, `user-card.tsx`
- Split code into multiple components - avoid monolithic page.tsx files
- Structure:
```
app/
  page.tsx
  layout.tsx
components/
  ui/          # shadcn primitives
  feature/     # feature-specific components
lib/
  utils.ts     # cn() and helpers
```

## Color System

ALWAYS use exactly 3-5 colors total:
- 1 primary brand color
- 2-3 neutrals (white, grays, off-whites, black variants)
- 1-2 accents

Rules:
- NEVER exceed 5 total colors
- NEVER use purple/violet prominently unless explicitly asked
- If overriding background color, MUST override text color for contrast
- Use semantic design tokens: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-destructive`, `border-border`

**Gradient Rules:**
- Avoid gradients unless explicitly asked
- If needed: use analogous colors only (blue→teal, purple→pink, orange→red)
- NEVER mix opposing temperatures: pink→green, orange→blue, red→cyan

## Typography

Maximum 2 font families:
- One for headings (can use multiple weights)
- One for body text

Rules:
- Use `leading-relaxed` or `leading-6` for body text (line-height 1.4-1.6)
- NEVER use decorative fonts for body text
- NEVER use fonts smaller than 14px
- Apply fonts via `font-sans`, `font-serif`, `font-mono` classes
- Wrap titles in `text-balance` or `text-pretty` for optimal line breaks

## Tailwind Patterns

**Layout Method Priority:**
1. Flexbox for most layouts: `flex items-center justify-between`
2. CSS Grid only for complex 2D layouts: `grid grid-cols-3 gap-4`
3. NEVER use floats or absolute positioning unless necessary

**Required Patterns:**
- Use Tailwind spacing scale: `p-4`, `mx-2`, `py-6` (NOT `p-[16px]`)
- Use gap classes for spacing: `gap-4`, `gap-x-2`, `gap-y-6`
- Use semantic classes: `items-center`, `justify-between`, `text-center`
- Use responsive prefixes: `md:grid-cols-2`, `lg:text-xl`
- NEVER mix margin/padding with gap on same element
- NEVER use `space-*` classes for spacing

## Component Patterns

### Cards
```tsx
<div className="rounded-lg border bg-card p-6 shadow-sm">
  <h3 className="text-lg font-semibold">Title</h3>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Buttons
```tsx
<button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
  Click me
</button>
```

### Inputs
```tsx
<input 
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  placeholder="Enter text..."
/>
```

### Badges
```tsx
<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
  Badge
</span>
```

## Layout Patterns

### Centered Container
```tsx
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

### Grid Layout
```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {/* Grid items */}
</div>
```

### Flex Layout
```tsx
<div className="flex items-center justify-between gap-4">
  {/* Flex items */}
</div>
```

## Icons

Import from Lucide React:
```tsx
import { Check, X, ChevronRight, Search, Menu, Plus, Trash2, Settings } from "lucide-react"
```

Rules:
- Use consistent icon sizing: 16px, 20px, or 24px
- NEVER use emojis as icons

## Images & Media

- Use `/placeholder.svg?height={h}&width={w}&query={description}` for placeholders
- Set `crossOrigin="anonymous"` for `new Image()` when rendering on canvas
- Add alt text for all images unless decorative

## Accessibility

- Use semantic HTML: `<main>`, `<header>`, `<nav>`, `<section>`, `<article>`
- Add proper ARIA roles and attributes
- Use `sr-only` class for screen reader text
- Make interactive elements keyboard accessible
- Ensure color contrast meets WCAG guidelines

## Data Fetching

- Use SWR for client-side data fetching and caching
- Do NOT fetch inside useEffect
- Pass data down from RSC or use SWR

## Design Tokens (globals.css)

```css
@import 'tailwindcss';

@theme inline {
  --font-sans: 'Geist', 'Geist Fallback';
  --font-mono: 'Geist Mono', 'Geist Mono Fallback';
  
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;
  --radius: 0.5rem;
}
```

## Best Practices Checklist

- [ ] Mobile-first design, then enhance for larger screens
- [ ] Use `className` not `class`
- [ ] Prefer `gap-*` over margin for spacing between elements
- [ ] Add loading states with `animate-pulse` or spinners
- [ ] Use `truncate` for potentially long text
- [ ] Keep components small, composable, and reusable
- [ ] Use TypeScript for type safety
- [ ] Handle loading and error states gracefully

## Final Rule

Ship something interesting rather than boring, but never ugly. Prioritize clean, modern aesthetics with excellent UX.
