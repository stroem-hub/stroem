# Component Library

This directory contains the custom component library for the Strøm UI, organized using atomic design principles.

## Structure

### Atoms (`/atoms`)
Basic building blocks that can't be broken down further:
- Button
- Input
- Card
- Badge
- Avatar
- Spinner

### Molecules (`/molecules`)
Simple combinations of atoms that function together:
- FormField (Input + Label + Error)
- SearchBox (Input + Search Icon)
- MetricCard (Card + Icon + Text)
- NavigationItem (Icon + Text + Badge)
- Toast (Icon + Text + Close Button)

### Organisms (`/organisms`)
Complex components made of molecules and atoms:
- Sidebar (Navigation Items + User Profile)
- Table (Headers + Rows + Pagination)
- Modal (Card + Backdrop + Actions)
- ActivityFeed (List of Activity Items)
- Dashboard (Multiple Metric Cards + Charts)

### Templates (`/templates`)
Page-level layouts that define structure:
- PageLayout (Header + Sidebar + Content)
- AuthLayout (Centered form layout)

### Icons (`/icons`)
SVG icon components with consistent styling and props

## Design System

### Colors
- Primary: Blue scale for main actions and branding
- Gray: Neutral colors for text and backgrounds
- Status: Success (green), Warning (yellow), Error (red), Info (blue)

### Typography
- Font Family: Inter for UI text, JetBrains Mono for code
- Scale: 12px to 48px with consistent line heights

### Spacing
- Scale: 0.25rem to 4rem (xs to 3xl)
- Consistent padding and margin utilities

### Themes
- Light and dark theme support
- CSS custom properties for easy theme switching
- Automatic system preference detection

## Usage

```typescript
import { Button, Card, Input } from '$lib/components';

// Use components with TypeScript support
<Button variant="primary" size="md" onclick={handleClick}>
  Click me
</Button>
```

## Development Guidelines

1. **TypeScript First**: All components must have proper TypeScript interfaces
2. **Accessibility**: Follow WCAG 2.1 AA guidelines
3. **Responsive**: Components should work on all screen sizes
4. **Consistent**: Use design tokens and follow established patterns
5. **Testable**: Components should be easy to test and document