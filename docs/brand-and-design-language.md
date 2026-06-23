# TENET — Brand & Design Language ("Soft Focus")

> The visual source of truth. Every value here is **extracted from the live codebase**
> (`app/components/*.module.css`, `lib/prioritization.ts`, `app/globals.css`), not invented.
> When the dark-mode + design-token pass lands (see `docs/roadmap-and-research.md`), this file
> defines the tokens to create. Pair with `CLAUDE.md` (conventions) and the spec docs.

> ⚠️ **Canonical reference = the Clock + the Calendar.** These two surfaces define "Soft Focus";
> derive new work from them and from this guide, never from a single component in isolation.
> *(History: the **Sticky Notes** & **Habit Tracker** were off-brand — warm note-paper,
> multi-colour per-card accents, emoji — and were rebuilt to this spec on 2026-06-23: monochrome
> white soft cards, green only where it carries meaning. They now conform.)*

---

## 0. What this style *is* (the question this doc answers)

TENET's look is **not a single style** — it's a deliberate stack of four recognizable, googleable
design movements. Knowing their names lets you extend the app without guessing:

1. **Neumorphism** — *a.k.a. "Soft UI" / "Neo-skeuomorphism"* (term popularized ~2020 by Michał
   Malewicz). The signature: **one near-white surface color**, with elements that look *extruded
   from* or *pressed into* the background using **paired soft shadows** — a dark shadow on one
   edge, a light highlight on the opposite edge. Your `ToggleButton` and clock are textbook
   examples (the class is literally `.skeuomorphic`). Known weakness to respect: **low contrast** —
   never rely on a neumorphic shadow alone to convey state; pair it with color or text.
2. **Dieter Rams / Braun functionalism** — *"Weniger, aber besser"* (less, but better). The analog
   clock — white face, black batons, a single red second hand, clean geometric numerals — is the
   same lineage as the original iOS Clock. Rams' principles ("good design is unobtrusive… honest…
   as little design as possible") are the philosophy behind the whole app.
3. **Apple Human Interface "material"** — frosted translucent glass (the dock:
   `rgba(255,255,255,.85)` + `backdrop-filter: blur(12px)`), system/SF-style type, rounded
   rectangles, hairline borders, the rounded "Today" pill + circular nav. Reads like Apple Calendar.
4. **Material Design palette** — the accent and status colors are **exact Google Material 500
   swatches**: Green 500 `#4caf50`, Red 500 `#f44336`, Orange 500 `#ff9800`, Grey 500 `#9e9e9e`.

**The combined system, in one line:** *Neumorphic Soft-UI minimalism on a Rams/Braun functionalist
foundation, finished with an Apple material layer, colored by Material Design.* We call it
**"Soft Focus."** Tagline (riffing on Rams): **"Less, but tactile."**

---

## 1. Design principles (the "why" — read before designing anything)

1. **Calm & unobtrusive.** The interface recedes; the *task* is the foreground. Lots of negative
   space — the clock floats alone in a field of off-white. (Rams: *good design is unobtrusive*.)
2. **Tactile honesty.** Controls look physically pressable and respond physically — they **lift on
   hover** (`translateY(-1px)`) and **press on click** (`translateY(1px)` + reduced shadow). The
   shadow tells the truth about whether a thing is raised (idle) or pushed-in (active).
3. **One accent at a time.** The canvas is monochrome; a **single green** means "go / focus /
   positive / active." Color is **reserved for meaning** (see the semantic palette), never used as
   decoration. A screen with two competing accent colors is a bug.
4. **Restraint in weight.** Headlines and big readouts are **Medium (500), not Bold (700)**. Large
   but quiet — "June 2026" and "Σ 100 min" are both large *and* weight-500. This is the single most
   characteristic typographic move; preserve it.
5. **Quiet by default, loud only when earned.** Pulsing/red animation is reserved for genuine
   attention (timer needs you). Reminders are foreground-only by design — the app never shouts.
6. **Portable & token-driven.** Per `CLAUDE.md`, logic and (soon) design values live as
   framework-agnostic tokens so the future native edition reuses them. Hard-code nothing that
   §10's tokens already name.

---

## 2. Color

### 2.1 Canvas & surfaces (the neumorphic base)

Neumorphism **requires** the page background to be *slightly off pure-white* so raised white
elements read against it. Honor this — a clock face (`#fff`) on a `#fff` page would be invisible.

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#f7f8fa` (home) · `#f4f5f7` (modals) | Near-white home background. Raised surfaces (clock, sticky notes, habit cards, toggle) get depth from a **145° gradient surface + a soft, layered, downward drop shadow** that blends on near-white — *not* grey dual-halo neumorphism (its white half can't read on white, leaving an unblended dark ring). |
| `--surface` | `#ffffff` | Raised surfaces: cards, clock face, notes, modals, popovers. |
| `--surface-sunken` | `#fafafa` / `#f8f8f8` | Inputs, secondary buttons, day-of-week header, empty cells. |
| `--surface-muted` | `#f5f5f5` / `#f2f2f2` | Pill buttons ("Today"), chips, hover fills. |
| `--grid-line` | `#ececec` | The 1px gaps in the calendar grid. |
| `--hairline` | `rgba(0,0,0,0.05–0.10)` | Borders & dividers. Always low-alpha black, never a solid grey. |
| `--edge-highlight` | `rgba(255,255,255,0.5–0.7)` | Top inset highlight on surfaces (`inset 0 1px 0 …`). |

### 2.2 Ink ramp (text — a pure neutral grey scale)

Text is a **monochrome ramp**. `#333` is the de-facto body color (most-used ink in the app); pure
black is avoided.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#171717` | Foreground token / max-emphasis. |
| `--ink-strong` | `#222` | "Today" date, hero numbers. |
| `--ink-body` | `#333` | **Default body text.** |
| `--ink-secondary` | `#444` – `#555` | Headers, controls, secondary copy. |
| `--ink-muted` | `#666` – `#777` | Captions, day headers, labels. |
| `--ink-faint` | `#888` – `#999` | Helper/hint text, placeholders, inactive dock items. |
| `--ink-disabled` | `#aaa` – `#ccc` | Disabled, out-of-month days, delete-X idle. |

### 2.3 The accent — Green (the brand's one functional color)

`#4caf50` (**Material Green 500**) is the most-used color in the entire app. It means
**focus / positive / active / "schedule it" (Eisenhower Q2)** — all the same idea: time well spent.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#4caf50` | Primary green: active nav, save buttons, focus rings, event dots, selected day. |
| `--accent-hover` | `#43a047` (Green 600) | Hover/border on green elements. |
| `--accent-ink` | `#2e7d32` (Green 800) | **Text** on green tints (event pill labels) — for contrast/AA. |
| `--accent-olive` | `#71a600` | The focus-minutes numerals on the calendar. |
| `--accent-tint-08…18` | `rgba(76,175,80, .08 / .10 / .12 / .16 / .18)` | Tinted backgrounds, selected fills, the focus ring `0 0 0 3px rgba(76,175,80,.12)`. |

### 2.4 Semantic / status palette = the Eisenhower quadrants

Color carries **meaning**, defined once in `lib/prioritization.ts` (`QUADRANT_META`). Reuse these —
don't introduce new status colors.

| Meaning | Quadrant | Hex | Material | Also used for |
|---|---|---|---|---|
| **Urgent + Important** ("do now") | Q1 | `#f44336` | Red 500 | Destructive/delete hover, "needs attention" pulse. The clock's second hand is a sibling red `#c00`. |
| **Important, not urgent** ("schedule") | Q2 | `#4caf50` | Green 500 | = the global accent. |
| **Urgent, not important** ("delegate") | Q3 | `#ff9800` | Orange 500 | Warnings / "delegate." |
| **Neither** ("drop") | Q4 | `#9e9e9e` | Grey 500 | De-emphasized / dismissable. |

Tints follow the accent pattern: `rgba(244,67,54,.1)` (red wash), `rgba(0,0,0,.05)` (neutral wash).

### 2.5 No warm "paper" palette

"Soft Focus" is a **cool, monochrome** system. The Sticky Notes & Habit Tracker once used a warm
yellow note-paper family (`#fffef9` … `#ffec85`) plus multi-colour per-card accents; both were
**removed** in the 2026-06-23 redesign. They are now white `--surface` cards on `--canvas` (like
the calendar), carrying meaning only through the **green accent** and the semantic quadrant hues —
never a paper colour. A thin green accent detail is acceptable; warm yellow is not.

---

## 3. Typography

### 3.1 Families

| Role | Family | Where |
|---|---|---|
| **Primary UI** | **Inter** (300/400/500/600) | 30+ components — the workhorse. `@import` of Google Fonts Inter. |
| **Brand / shell** | **Geist Sans** + **Geist Mono** | Next.js root font (`--font-geist-sans`), splash title. |
| **System fallback** | `"SF Pro Display", "Helvetica Neue", Arial` | Clock status; the native-feel fallback. |

> **Standardize on `Inter` for UI, `Geist` for the wordmark/splash.** Both are humanist
> geometric sans-serifs — consistent with the Apple/Rams feel. Stack:
> `"Inter", -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`.

### 3.2 Weight discipline (signature rule)

| Weight | Name | Use |
|---|---|---|
| 300 | Light | Rare — large decorative numerals only. |
| 400 | Regular | Body copy, secondary labels. |
| **500** | **Medium** | **The default for almost everything** — UI labels, clock numbers, *and the large headings/readouts.* |
| 600 | Semibold | Section headers, day-of-week, emphasis, primary-button text. |
| 700 | Bold | Reserved: splash title, the toggle "label." Use sparingly. |

**Rule: headings and hero numbers are 500, not 700.** Quiet, not shouty. (See §1.4.)

### 3.3 Type scale (observed)

| Step | px | Weight | Example |
|---|---|---|---|
| Micro | 9.5–11 | 500–600 | Cell events, dock labels, hints, minutes value |
| Small | 12.5–13 | 400–600 | Hints, day-of-week, note body |
| Base | 14 | 500 | Body, inputs, list items |
| Control | 15–16 | 500–600 | Buttons, popover date |
| Status | 18 | 400 | Clock status text |
| Hour numerals | 22 | 500 | Clock face |
| Title | 28 | 500 | "June 2026", modal title |
| Hero readout | 32–38 | 500 | "Σ 100 min" |

Tracking: near-zero; a hint of positive letter-spacing on hero readouts (`letter-spacing: 1px` on
`.totalTime`) and tiny labels (`0.2px` on dock labels). Line-height ~1.35–1.4 for multi-line copy.

---

## 4. Elevation — the neumorphic shadow system (the signature)

**Never** use a single hard `box-shadow: 0 2px 4px #000` — that breaks the language. The home runs a
**near-white** canvas, so depth comes from a gradient surface + a soft layered drop shadow. (Grey
dual-halo neumorphism was tried and reverted: its white shadow can't read on white — it leaves a
hard dark ring that doesn't blend — and the grey canvas changed the whole app's theme.)

### Tier 0 — Soft elevation on white (home cards, clock bezel, toggle)
A 145° **surface gradient** does the "lit from top-left" work; a soft, downward, **layered** drop
shadow blends into the near-white canvas. `inset` a dark shadow for a pressed/sunken "well" (the
dark half still reads on white). One material, shared by cards + the clock bezel + the toggle.
```css
/* raised (convex) — sticky notes, habit cards, clock bezel, toggle, knobs */
background: linear-gradient(145deg, #ffffff, #f1f3f7);
box-shadow: 0 5px 15px rgba(30,41,59,0.10), 0 2px 5px rgba(30,41,59,0.05),
  inset 0 1px 0 rgba(255,255,255,0.9);
/* pressed (concave) — habit check well, day dots */
box-shadow: inset 3px 3px 6px rgba(30,41,59,0.13), inset -2px -2px 5px rgba(255,255,255,0.95);
```
The **Create modal** (`TodoPanel` — the Task / Sticky / Habit composer) is built from this same
material: a gradient modal shell, a **concave segmented track with a raised active pill**,
**inset-well inputs**, and **convex add/edit/delete knobs**. Colour stays minimal — a subtle green
tint on active chips/flags, a small quadrant colour-**dot** (not a solid badge), and an orange tint
only on the Urgent flag. Emoji are replaced with dock-style monochrome line icons.

The **Matrix dashboard** (`MatrixDashboard` + `EisenhowerMatrix`) uses it too: a near-white canvas,
**raised quadrant tiles** with a coloured top cap, a **concave focus-meter well**, and the same
concave→convex task checks. The four quadrant hues (`#f44336`/`#4caf50`/`#ff9800`/`#9e9e9e`) are the
only strong colour — top caps + name dots + the green on-track meter — and the 🍅 estimate became a
monochrome clock glyph.

The **account / profile control** (`AuthButton`, top-right) follows suit: the avatar sits in a
**raised neumorphic disc** with a soft white ring (padding + gradient bezel) so the photo pops, like
the reference profile circle; sign-in pills and the account menu use the same raised/soft-elevation
material.

### Tier 1 — Soft ambient card (clock, calendar, panels)
Low-alpha, large-blur, layered — taken from the two canonical surfaces. Often plus a 1px **inset
top highlight** for the "edge of glass."
```css
/* clock face / bezel */
box-shadow: 0 4px 10px rgba(0,0,0,0.10);                       /* face    */
box-shadow: 0 6px 15px rgba(0,0,0,0.10);                       /* bezel   */
/* calendar grid / readout */
box-shadow: 0 4px 15px rgba(0,0,0,0.05);                       /* grid    */
box-shadow: 0 2px 10px rgba(0,0,0,0.05), inset 0 1px 0 #fff;   /* readout */
/* surface edge highlight (add to cells/cards) */
box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
```

### Tier 2 — Neumorphic extruded control (THE hero recipe — the start button)
The defining "soft UI" look: **outer dark-down + outer light-up + several inner light insets.**
Copy this verbatim for any large primary tactile control.
```css
/* idle — raised */
box-shadow:
  0 10px 20px -4px rgba(0,0,0,0.30),          /* outer drop (down)      */
  inset 0 -2px 3px -1px rgba(0,0,0,0.10),      /* inner bottom shade     */
  0 -8px 12px -1px rgba(255,255,255,0.50),     /* outer top highlight    */
  inset 0 2px 3px -1px rgba(255,255,255,0.20), /* inner top highlight    */
  inset 0 0 4px 1px rgba(255,255,255,0.60),    /* inner glow             */
  inset 0 15px 25px 0 rgba(255,255,255,0.20);  /* inner top sheen        */
background: #eaeaea;

/* pressed/active — pushed in (swap outer for inner darks) */
box-shadow:
  0 8px 20px -4px rgba(0,0,0,0.30),
  inset 0 -6px 20px 1px rgba(255,255,255,0.80),
  0 -8px 12px -1px rgba(255,255,255,0.50),
  inset 0 6px 20px 0 rgba(0,0,0,0.30),
  inset 0 0 8px 1px rgba(255,255,255,0.50);
```
**Attention state** recolors this to red `#f44336` and adds a `pulse-button` ring — and *only* then.

### Tier 3 — Pressable micro-button (Today pill, circular nav ‹ ›)
Small drop + inset highlight; lifts on hover, presses on active. Tactile but subtle.
```css
box-shadow: 0 2px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.5);
/* :hover */ transform: translateY(-1px);  box-shadow: 0 3px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5);
/* :active*/ transform: translateY(1px);   box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5);
```

### Material / glass (the dock, overlays)
```css
background: rgba(255,255,255,0.85);
backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
border-top: 1px solid rgba(0,0,0,0.07);
box-shadow: 0 -2px 12px rgba(0,0,0,0.05);   /* shadow points UP for a bottom bar */
```
Modal backdrop is always `rgba(0,0,0,0.5)`; modal card adds a neumorphic edge:
`inset 0 2px 0 rgba(255,255,255,.5), inset 0 -3px 0 rgba(0,0,0,.1)`.

---

## 5. Shape & radius

Soft, generous, never sharp. Bigger surfaces get bigger radii.

| Token | px | Use |
|---|---|---|
| `--r-xs` | 4–6 | Event pills, tiny chips, small list rows |
| `--r-sm` | 8–9 | Buttons, inputs, "Today" pill |
| `--r-md` | 12 | Cards, calendar grid |
| `--r-lg` | 14–16 | Notes, popovers, modals |
| `--r-full` | 9999 / 50% | Clock, circular nav, dots, center pin, the toggle |

---

## 6. Spacing & layout

- **Rhythm:** an ~`4px` base step — observed gaps/padding cluster at `3, 6, 8, 10, 12, 14, 16, 18, 22px`.
- **Single-column, centered, breathable.** The hero (clock) sits alone with wide margins.
- **Panels are centered modal overlays** (`page.tsx` `activePanel`, mutually exclusive), dark
  backdrop, white rounded card, `max-width ≈ 560px`, `max-height: 90vh`, internal scroll.
- **Bottom dock** is fixed, frosted, safe-area aware: `padding-bottom: calc(8px + env(safe-area-inset-bottom))`.
- Mobile breakpoint at **`640px`** — scale down type and cell heights, keep affordances (e.g. the
  delete-X stays visible on touch since there's no hover).

---

## 7. Iconography & imagery

- **Line icons, thin uniform stroke, monochrome** (inherit `currentColor`): the sun/sunburst
  "start focus" glyph, the chevrons `‹ ›`, dock glyphs. No filled/duotone icons.
- **Emoji only when meaningful, never decorative.** 🍅 tomatoes are the Pomodoro counter —
  **greyscaled + 30% opacity until earned**, then full-color (`filter: grayscale(1)→0`,
  `opacity .3→1`). Earned color is itself a reward. Don't sprinkle emoji elsewhere.
- **Elegant glyphs over labels** where it reads as refined: `Σ` for the minutes sum.
- **Logo:** `public/logo.png`, shown on the splash with a gentle `pulse` (scale 1→1.05). Keep it
  centered, on `--surface`, with quiet `Geist`/`Inter` wordmark beneath.

---

## 8. Motion

Subtle, physical, fast. Motion confirms touch and eases entrances — it never decorates.

| Pattern | Timing | Use |
|---|---|---|
| Standard transition | `0.18s–0.3s ease` | Hover/active color, background, transform. |
| Hero button | `300ms cubic-bezier(0.23, 1, 0.32, 1)` | Smooth decelerating press (ease-out-quint feel). |
| `popIn` | `0.16s ease` | Popovers — fade + `translateY(-4px)` + `scale(.98)→1`. |
| `fadeIn` | `0.5s ease-in-out` | Splash. |
| Tap feedback | `scale(0.95)` | Dock items on `:active`. |
| Lift / press | `translateY(∓1px)` | All Tier-3 buttons. |
| `pulse` ring | `1.5s infinite` | **Attention only** — red expanding ring on the timer. |

**Always honor `@media (prefers-reduced-motion: reduce)`** — disable non-essential entrance and
tap animations when it's set. Avoid bouncy overshoot easings; they read as decorative (see §1.5).

---

## 9. Voice & tone (microcopy)

The writing matches the visuals: **quiet, gentle, instructive, lowercase-leaning, no exclamation.**

- Instructional, not commanding: *"Tap to start a 25-min focus."* · *"Double-click a day to add an event."*
- Helper text is short, in `--ink-faint` grey, sentence case.
- Calm and a little intellectual — the brand name **TENET** is a palindrome (the Sator square); the
  app calls itself *"Most Minimalist Pomodoro Timer Ever."* Lean into understated, precise,
  unhurried language. Never gamified hype, never nagging.

---

## 10. Ready-to-use design tokens

Drop into `app/globals.css` `:root` when you do the token pass (this is the prerequisite the
roadmap calls out — it turns `QUADRANT_META` + these scattered hexes into one source).

```css
:root {
  /* surfaces */
  --canvas: #f4f5f7;
  --surface: #ffffff;
  --surface-sunken: #f8f8f8;
  --surface-muted: #f5f5f5;
  --grid-line: #ececec;
  --hairline: rgba(0, 0, 0, 0.08);
  --edge-highlight: rgba(255, 255, 255, 0.6);

  /* ink ramp */
  --ink: #171717;
  --ink-strong: #222222;
  --ink-body: #333333;
  --ink-secondary: #555555;
  --ink-muted: #777777;
  --ink-faint: #999999;
  --ink-disabled: #bbbbbb;

  /* accent (green = focus/positive/active) */
  --accent: #4caf50;
  --accent-hover: #43a047;
  --accent-ink: #2e7d32;
  --accent-olive: #71a600;
  --accent-tint: rgba(76, 175, 80, 0.10);
  --accent-tint-strong: rgba(76, 175, 80, 0.18);
  --accent-ring: 0 0 0 3px rgba(76, 175, 80, 0.12);

  /* semantic = Eisenhower quadrants (mirror QUADRANT_META) */
  --status-urgent: #f44336;   /* Q1 do-now / destructive */
  --status-focus:  #4caf50;   /* Q2 schedule (= accent)  */
  --status-warn:   #ff9800;   /* Q3 delegate             */
  --status-mute:   #9e9e9e;   /* Q4 drop                 */

  /* radius */
  --r-xs: 5px;  --r-sm: 9px;  --r-md: 12px;  --r-lg: 16px;  --r-full: 9999px;

  /* elevation — derived from the clock bezel + calendar grid (canonical) */
  --shadow-card: 0 6px 15px rgba(0,0,0,0.10);
  --shadow-card-edge: inset 0 1px 0 rgba(255,255,255,0.7);
  --shadow-press: 0 2px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.5);
  --glass: rgba(255,255,255,0.85);

  /* motion */
  --ease-standard: 0.2s ease;
  --ease-press: 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
```

### Dark-mode mapping (when you build it)

Neumorphism in dark mode flips the math: the canvas becomes a **dark grey** (≈ `#1c1c1e`, *not*
pure black — you need room for a *darker* shadow below it), surfaces sit slightly lighter
(`#2a2a2d`), the dark shadow goes near-black and the light highlight becomes a **low-alpha white**
(≈ `rgba(255,255,255,0.05)`). Keep the **green accent and the four semantic hues identical** — they
already read on dark. Invert the ink ramp (`--ink: #ededed` … `--ink-faint: #8a8a8a`).

---

## 11. Do / Don't checklist

**Do**
- Put white surfaces on the off-white `--canvas`, never on pure white.
- Use the three-tier shadow system; add the 1px inset top highlight to surfaces.
- Make buttons lift on hover and press on active.
- Keep one accent (green) per screen; let color mean something.
- Set headings/hero numbers to weight **500**.
- Honor safe-area insets and `prefers-reduced-motion`.

**Don't**
- Don't use pure black text or a single hard drop-shadow.
- Don't rely on a neumorphic shadow *alone* to show state (low contrast — add color/label/icon).
- Don't introduce a new status color outside the four Material quadrant hues.
- Don't make headings bold-700 or add decorative emoji/gradients.
- Don't break the fragile DOM contract in `Clock.tsx` (`#main-toggle`, `.button`, `button-red`) —
  see `CLAUDE.md`.

---

*Style lineage to research further: "Neumorphism / Soft UI" (Michał Malewicz), Dieter Rams'
"Ten Principles for Good Design" & Braun, Apple Human Interface Guidelines (materials/vibrancy),
and the Google Material Design color system.*
