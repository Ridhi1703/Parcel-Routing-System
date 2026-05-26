# ParcelFlow — Design Moodboard

> This file is the authoritative design reference. All frontend work must follow these specs exactly. The original prompt described a "Void Space" dark theme — that was **replaced** in full with this indigo/slate light system. Do not revert.

---

## Palette

| Token | Hex | Usage |
|---|---|---|
| `brand-600` | `#4f46e5` | Primary CTA, active nav, links, focus rings |
| `brand-700` | `#4338ca` | Primary button hover |
| `brand-50` | `#eef2ff` | Sidebar background, active nav bg, hover bg |
| `brand-100` | `#e0e7ff` | Dividers, borders on indigo surfaces |
| `brand-200` | `#c7d2fe` | Subtle borders, hover border on inputs |
| `slate-50` | `#f8fafc` | App shell / main content background |
| `slate-100` | `#f1f5f9` | Table row hover, inner section dividers |
| `slate-200` | `#e2e8f0` | Default input borders, card borders |
| `slate-300` | `#cbd5e1` | Disabled states |
| `slate-400` | `#94a3b8` | Placeholder text, icon muted, meta labels |
| `slate-500` | `#64748b` | Body secondary text, section labels |
| `slate-600` | `#475569` | Nav item text (inactive) |
| `slate-700` | `#334155` | Body primary text |
| `slate-800` | `#1e293b` | Input values, strong labels |
| `slate-900` | `#0f172a` | Page headings |
| `white` | `#ffffff` | Card backgrounds, input backgrounds |

### Status / Semantic colours

| Status | Background | Text / Border | Usage |
|---|---|---|---|
| `ROUTED` | `#dcfce7` | `#15803d` | Parcel successfully routed |
| `PENDING` / `QUEUED` | `#dbeafe` | `#1d4ed8` | Awaiting processing |
| `INSURANCE_HOLD` | `#fef9c3` | `#a16207` | Held for insurance review |
| `FAILED` | `#fee2e2` | `#b91c1c` | Processing failed |
| `DEAD_LETTER` | `#f1f5f9` | `#475569` | Exhausted retries |
| Danger action | `#ef4444` bg | `#fff` text | Destructive buttons |
| Warning surface | `#fef3c7` bg | `#d97706` icon | ConfirmModal warning icon bg |

---

## Typography

- **Font stack**: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif — no external font imports
- **Base size**: 15px on `<html>` / `<body>`
- **Monospace** (parcel IDs, code, rule IDs): `font-family: monospace` — no specific family needed
- **No IBM Plex** — the original prompt called for it but it was never loaded; stick with the system stack

| Scale | Size | Weight | Usage |
|---|---|---|---|
| Page heading | 24px | 700 | `<h1>` on every page |
| Card section label | 11px | 600 | Uppercase + letter-spacing 0.08em |
| Nav section label | 10px | 600 | Uppercase + letter-spacing 0.1em |
| Body / form label | 13–14px | 500–600 | Labels, table cells |
| Meta / caption | 11–12px | 400–500 | Timestamps, sub-labels, badge text |

---

## Spacing

8px grid. Use these values only: `4 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 32 / 48px`.

---

## Border radius

| Element | Radius |
|---|---|
| Cards | `12px` |
| Inputs, selects | `8px` |
| Buttons (md/lg) | `8px` |
| Buttons (sm) | `7px` |
| Badges / pills | `20px` (full pill) |
| Operator picker buttons | `8px` |
| Icon containers | `8px` |
| ConfirmModal dialog | `16px` |
| Toast | `10px` |

---

## Shadows

| Element | Shadow |
|---|---|
| Cards | `0 1px 4px rgba(0,0,0,0.05)` |
| Active nav item | `0 1px 4px rgba(79,70,229,0.3)` |
| ConfirmModal | `0 24px 64px rgba(0,0,0,0.18)` |
| Modal (generic) | `0 20px 60px rgba(0,0,0,0.15)` |

---

## Components

### AppShell
- No topbar. Sidebar only.
- Layout: `display: flex; height: 100vh`
- Main content: `background: #f8fafc; flex: 1; overflow-y: auto; padding: 32px`
- Sidebar sits on the left; transitions width with CSS

### Sidebar
- Width: `240px` expanded / `64px` collapsed
- Background: `#eef2ff`
- Right border: `1px solid #e0e7ff`
- **Toggle collapse**: click the logo/brand area (Layers icon + "ParcelFlow" text) — no separate chevron button
- Collapse state persisted to `localStorage` key `pf_sidebar_collapsed`
- Transition: `width 200ms ease, min-width 200ms ease`
- Collapsed mode: icon-only nav items, centred; logo shows icon only
- Active nav item: `background: #4f46e5`, `color: #fff`, `border-radius: 8px`
- Hover nav item: `background: #e0e7ff`, `color: #4f46e5`
- Section labels hidden when collapsed; replaced by a `24px` height spacer
- User footer: username + role label (hidden when collapsed) + logout icon button
- Logout triggers `ConfirmModal` (full-screen), never inline

### Buttons
| Variant | Background | Text | Border | Hover bg |
|---|---|---|---|---|
| `primary` | `#4f46e5` | `#fff` | `#4f46e5` | `#4338ca` |
| `secondary` | `#fff` | `#334155` | `#e2e8f0` | `#eef2ff` + `#c7d2fe` border + `#4f46e5` text |
| `danger` | `#ef4444` | `#fff` | `#ef4444` | (darken) |
| `ghost` | `transparent` | `#4f46e5` | `transparent` | `#eef2ff` |

Sizes: `sm` 13px/5px–12px · `md` 14px/8px–18px · `lg` 15px/10px–24px

### Inputs
- Background: `#fff`
- Border: `1.5px solid #e2e8f0`
- Focus border: `#4f46e5` (via `outline` override or border swap)
- Border radius: `8px`
- Padding: `8px 12px`
- Font size: `14px`
- Number spinner arrows: hidden globally via CSS (`input[type=number]::-webkit-inner-spin-button { display: none }`)

### Cards
```css
background: #fff;
border-radius: 12px;
border: 1px solid #e2e8f0;
box-shadow: 0 1px 4px rgba(0,0,0,0.05);
```
Card section header: `padding: 14–16px`, `border-bottom: 1px solid #f1f5f9`, uppercase label in `#64748b`.

### Badges (status pills)
Full pill shape (`border-radius: 20px`), `font-size: 12px`, `font-weight: 600`, `padding: 3px 10px`.
Colours per status table above.

### ConfirmModal
- Full-screen overlay: `rgba(15,23,42,0.55)` + `backdrop-filter: blur(3px)` — **exception**: this is the only place `backdrop-filter` is permitted
- Dialog card: `420px` wide, `border-radius: 16px`, white background
- Icon area: `48px × 48px` rounded square, red or amber background per variant
- Layout: icon → title (18px/700) → message (15px/`#475569`) → buttons right-aligned
- ESC key dismisses (calls `onCancel`)
- Used for: logout, delete rule, apply rules, DLQ dismiss (single + bulk)
- **Never use inline confirm strips** — all confirmations go through this component

### Toast
Coloured fill (not white-bg). Top-right stack. Auto-dismiss 4s.

---

## Login page
Split-panel layout:
- Left half: `background: linear-gradient(135deg, #4f46e5, #6366f1)` with dot-grid SVG overlay and tagline — gradient is **permitted only on the login left panel**
- Right half: white card on `#f8fafc` background, centred form
- No gradient anywhere else in the app

---

## Rule Editor UX

Three-column layout: Rule List (220px) | Edit Panel (1fr) | Test Sandbox (1fr).

**Rule list items** show a human-readable summary, not a raw UUID. Format: `` `field` op value → action target `` (e.g. `weight_kg ≤ 1 → ROUTE_TO Mail Department`).

**Edit panel** uses a visual sentence builder:
- "Condition" section: `When [field ▾] [operator buttons] [value]`
- "Outcome" section: `[action ▾] → [target ▾]`
- Operator picker: horizontal pill button group (>, ≥, <, ≤, =)
- `SelectOrType` pattern: preset dropdown + "Custom…" option that reveals a free-text input
- Custom attributes: key/value grid with column headers and inline × remove

**Export / Import JSON**: buttons in the rule editor header to download the current rule chain as `rules.json` and to import from a JSON file (with ConfirmModal warning before overwrite).

**Confirm dialogs** (delete rule, apply rules) use `ConfirmModal` — not inline strips.

---

## General rules (non-negotiable)

1. No gradient backgrounds except the login left panel.
2. No glassmorphism — `backdrop-filter` only in `ConfirmModal` overlay.
3. Sidebar has no top bar / header — sidebar nav only.
4. No dark mode toggle.
5. No user management panel for admin.
6. All currency displays in **₹** — the backend field is `value_eur` but the UI always shows `₹`.
7. All parcel IDs in `font-family: monospace`.
8. Confirmation dialogs are always full-screen `ConfirmModal`, never inline.
9. Transitions: `150–200ms ease` on color/background/border only — no transform animations except sidebar width.
10. Tables over cards for list data.
