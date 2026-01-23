---
name: v0-frontend
description: Generate modern, beautiful UI components using Vercel v0 patterns with React, Tailwind CSS, and shadcn/ui
---

## When to use this skill

Use this skill when the user asks you to:
- Create UI components, pages, or layouts
- Build modern, responsive interfaces
- Generate shadcn/ui-style components
- Design forms, dashboards, cards, or other UI elements

## Tech Stack

- **React** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component patterns
- **Lucide React** for icons
- **Radix UI** primitives

## Design Principles

1. **Minimalist & Clean**: Use plenty of whitespace, avoid clutter
2. **Consistent Spacing**: Use Tailwind's spacing scale (p-4, gap-6, etc.)
3. **Subtle Animations**: Add `transition-all` and `hover:` states
4. **Dark Mode Ready**: Use `dark:` variants for all colors
5. **Accessible**: Include proper ARIA labels and semantic HTML

## Color Patterns

Use semantic color classes:
- `bg-background` / `text-foreground` for base
- `bg-primary` / `text-primary-foreground` for CTAs
- `bg-muted` / `text-muted-foreground` for secondary
- `bg-destructive` for errors
- `border-border` for borders

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
<button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2">
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
import { Check, X, ChevronRight, Search, Menu } from "lucide-react"
```

## Best Practices

1. Always use `className` not `class`
2. Prefer `gap-*` over margin for spacing between elements
3. Use `sr-only` class for screen reader text
4. Make interactive elements keyboard accessible
5. Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)
6. Add loading states with `animate-pulse` or spinners
7. Use `truncate` for potentially long text

## File Structure

For new components:
```
components/
  ui/
    button.tsx
    card.tsx
    input.tsx
  feature-name/
    feature-component.tsx
```

Remember: Keep components small, composable, and reusable.

