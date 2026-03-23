# Atlas GUI Redesign — Design Spec

## Overview

Complete GUI overhaul: replace the current sidebar+header layout with a service-rail+section-panel pattern. All 8 sections redesigned with consistent visual language. Reference mockup: `mockup-full-app.html`.

## Current Architecture

- `AppShell` — flex layout: Sidebar (w-56) + Header (h-14) + main content
- `Sidebar` — nav links grouped by category (General/Services/System)
- `Header` — page title, user info, theme toggle, notification bell, logout
- Each section page is standalone, rendered inside `<main>` with padding

## New Architecture

### Layout: ServiceRail + SectionPanel + Content

```
┌──────┬────────────┬─────────────────────────────┐
│ Rail │   Panel    │                             │
│ 52px │   220px    │       Main Content          │
│      │            │                             │
│ icons│ contextual │   section views, editors,   │
│      │ nav per    │   detail pages, tables      │
│      │ section    │                             │
└──────┴────────────┴─────────────────────────────┘
```

No header. User avatar, settings, theme in the rail bottom area.

### Component Tree

```
AppShell
├── ServiceRail (fixed 52px)
│   ├── Logo
│   ├── RailButton × 6 (dashboard, files, scheduler, notifications, notes, tracker)
│   ├── Spacer
│   ├── RailButton × 2 (audit, settings)
│   └── UserAvatar (initials, opens dropdown)
├── SectionPanel (220px, content varies by active section)
│   ├── PanelHeader (title + action buttons)
│   ├── PanelSearch (optional)
│   └── PanelScroll (groups + items)
└── MainContent (flex-1)
    └── [ActiveSectionView]
```

### ServiceRail

- 52px wide, darker background (`#eceef4`)
- Vertical icon buttons with tooltips on hover
- Active section highlighted with primary color fill
- Notification badge (red dot) on bell icon
- Bottom: divider, audit, settings, user avatar with initials
- Mobile: hidden, accessible via hamburger menu

### SectionPanel

Each section defines its own panel content. All share the same shell:
- Header: title + action buttons (new folder, new note, etc.)
- Optional search input
- Scrollable list of groups + items
- Items show icon, title, count/badge

Panel content by section:
- **Dashboard**: widget list
- **Files**: folder tree, quick filters (images, PDFs, public)
- **Scheduler**: groups with colored badges, status filters (running/failed/disabled)
- **Notifications**: filters (all/unread/read), channels, manage links
- **Notes**: folders with counts, recent notes list
- **Tracker**: endpoint list with status dots
- **Audit**: service filters, status counts
- **Settings**: profile, appearance, resources, health

### Section Views

Each section can have multiple views (list, detail, create, etc.). Views are swapped within the MainContent area.

| Section | Views |
|---------|-------|
| Dashboard | Widget grid |
| Files | List, Preview detail |
| Scheduler | Job list (grouped), Job detail (config + exec history) |
| Notifications | List, Preferences |
| Notes | Editor (edit), View, New note |
| Tracker | Endpoint list, Endpoint detail (chart + data) |
| Audit | Event log |
| Settings | Profile + Resources + Health |

### Modals

All modals share a consistent shell: overlay with blur, centered card (max-w-640), header/body/footer.

- **New Job** — name, type (webhook/JS), group, cron schedule, URL, method, timeout, headers, tags, hooks, enabled toggle
- **Edit Job** — same fields, pre-filled
- **Upload Files** — drag-and-drop zone, folder selector, tags
- **Create Endpoint** — name, display name, visibility, retention, schema builder (dynamic rows: field name + type)
- **Send Test Notification** — subject, body, channel checkboxes

### Drawers

- **History Drawer** (notes) — right-side panel (380px), timeline with version dots, restore buttons

### Removed Components

- `Header` — functionality absorbed by ServiceRail (user avatar dropdown for theme/logout)
- `Sidebar` — replaced by ServiceRail + SectionPanel
- Page titles — each view shows its own header inline

## Visual Design

Catppuccin Latte/Mocha theme preserved. Key tokens:
- Cards: 12px radius, subtle shadow
- Badges: 6px radius, colored backgrounds at 10% opacity
- Buttons: 8px radius, 13px font, 150ms transitions
- Tables: rounded container, uppercase 11px headers, hover highlight
- Editor: 720px max-width content, 48px horizontal padding, 32px title
- Toolbar: frosted glass (backdrop-blur), sticky
- Forms: 8px radius inputs, focus ring with ring color

## Data Flow

No backend changes. All existing API calls remain the same. The redesign is purely presentational — same hooks, same API client, same auth flow.

## File Structure

```
components/layout/
  app-shell.tsx        — rewrite: rail + panel + content
  service-rail.tsx     — NEW: icon navigation
  section-panel.tsx    — NEW: contextual panel shell
  panels/              — NEW: per-section panel content
    dashboard-panel.tsx
    files-panel.tsx
    scheduler-panel.tsx
    notifications-panel.tsx
    notes-panel.tsx
    tracker-panel.tsx
    audit-panel.tsx
    settings-panel.tsx
  user-menu.tsx        — NEW: avatar dropdown (theme, logout)

components/shared/
  modal.tsx            — NEW: reusable modal shell
  drawer.tsx           — NEW: reusable drawer shell
  page-header.tsx      — NEW: consistent page header

components/scheduler/
  new-job-modal.tsx    — NEW
  job-detail.tsx       — NEW

components/tracker/
  new-endpoint-modal.tsx — NEW
  endpoint-detail.tsx    — NEW

components/files/
  upload-modal.tsx     — NEW
  file-preview.tsx     — NEW

components/notifications/
  send-test-modal.tsx  — NEW
  preferences-view.tsx — NEW
```

Existing section pages (`app/(protected)/*/page.tsx`) will be updated to use the new layout components and visual styles. The notes components stay mostly the same but get restyled.

## Testing

- Existing tests remain valid (API calls unchanged)
- Visual testing via manual review against mockup
- Each section verified: list view, detail view, modals, drawers
