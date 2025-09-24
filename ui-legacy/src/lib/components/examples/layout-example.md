# PageLayout and Breadcrumb Components

## Overview

The PageLayout and Breadcrumb components provide a consistent layout structure with responsive design and accessibility features.

## Features

### PageLayout Component
- ✅ Flexible page header with title and subtitle
- ✅ Action buttons in header
- ✅ Consistent spacing and layout utilities
- ✅ Dark mode support
- ✅ Mobile responsive design
- ✅ Configurable max-width and padding
- ✅ Breadcrumb integration

### Breadcrumb Component
- ✅ Responsive breadcrumb navigation
- ✅ Home icon support
- ✅ Truncation for long labels
- ✅ Accessibility attributes (ARIA labels, semantic HTML)
- ✅ Dark mode support

### Layout Utilities
- ✅ Consistent spacing and alignment helpers
- ✅ Responsive design utilities
- ✅ Flexbox and grid helpers
- ✅ Container and padding utilities

## Usage Example

```svelte
<script lang="ts">
  import { PageLayout } from '$lib/components';
  import type { Breadcrumb } from '$lib/types';

  const breadcrumbs: Breadcrumb[] = [
    { label: 'Dashboard', href: '/' },
    { label: 'Settings', href: '/settings' },
    { label: 'Layout Test' }
  ];
</script>

<PageLayout 
  title="Page Title"
  subtitle="Page description"
  breadcrumbs={breadcrumbs}
  maxWidth="7xl"
  padding="lg"
>
  <div class="space-y-6">
    <!-- Page content here -->
  </div>
</PageLayout>
```

## Responsive Behavior

- **Desktop**: Full sidebar navigation with breadcrumbs and page header
- **Tablet**: Collapsible sidebar with responsive layout
- **Mobile**: Mobile-friendly navigation with touch interactions

## Accessibility

- Proper ARIA labels and semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences respected

## Testing

The components include comprehensive unit tests for:
- Layout utility functions
- Component integration
- Responsive behavior
- Accessibility features

Run tests with:
```bash
npm test -- --run src/lib/utils/layout.test.ts
npm test -- --run src/lib/components/integration.test.ts
```