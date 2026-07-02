# Life Command Centre Design

## Source of truth

This design is based on the attached `index.html` mockup and is intended to be applied across the `life-cc/` frontend.

## Visual Direction

- Warm, editorial command-centre aesthetic
- Ivory page background with white, slightly lifted cards
- Sage and tan accents instead of a cool dark theme
- Rounded rectangles with soft borders and restrained shadows
- Dense information layout, but with generous whitespace between major groups

## Layout Model

- Fixed left sidebar on desktop, stacked top-to-bottom on mobile
- Compact top bar with search, utility actions, and sync control
- Main content area with a page header and scrollable card grid
- Dashboard uses a 4-tile KPI row and a 3-column content grid
- Secondary routes reuse the same card surfaces and typography but collapse into single-column feeds

## Palette

- Page background: `#f0ece4`
- Primary surface: `#ffffff`
- Soft surface: `#faf7f2`
- Muted surface: `#f4eee5`
- Border: `#ece4d8`
- Primary text: `#1a1a1a`
- Secondary text: `#6f6458`
- Tertiary text: `#a09688`
- Sage accent: `#3d4a3e`
- Success: `#4caf50`
- Warning: `#f5a623`
- Attention: `#e05c5c`
- Info: `#4a90d9`
- Editorial gold: `#c8a882`

## Typography

- Use the system stack already present in the mockup
- Large page titles are bold but compact
- Section labels are small, uppercase, and muted
- Numbers use tabular figures for stable alignment

## Component Rules

- Sidebar
  - White panel with a thin right border
  - Logo block at the top
  - Sectioned nav with active-pill treatment
  - Focus card near the lower half
  - User/footer controls pinned to the bottom
- Top bar
  - Search pill on the right side
  - Small square utility buttons
- KPI cards
  - White cards with soft gradient tints
  - Large numeric value, short label, tiny status sublabel
  - Mini visual indicator at the bottom
- Content cards
  - Rounded 16px cards
  - Thin border, subtle shadow, tight internal spacing
  - Header row with title and secondary action link
- List rows
  - Compact rows with icon/dot, main label, secondary metadata, and status pills
- AI surfaces
  - Warm gradient panel for briefing content
  - Prompt box styled like a quick-capture field

## Route Mapping

- `/dashboard`
  - Use the full editorial dashboard composition
  - Greeting header, KPI row, briefing card, quick-add card, and category preview cards
- `/connections`
  - Use the same surfaces but present connector status as a warm status board
- `/loops`, `/deadlines`, `/recurring`, `/documents`, `/followups`, `/snoozed`
  - Use a focused list view with helper copy and empty states
- `/ai`
  - Stack the briefing and ask-a-question surfaces in the same card language

## Implementation Notes

- Keep the existing data flow and routes intact
- Replace the dark shell with shared warm surfaces rather than per-page one-offs
- Reuse the same card primitives across dashboard, category views, and connector views
- Preserve accessible focus states and keyboard behavior
- Keep the UI responsive by collapsing the desktop three-column layout into one column on small screens
