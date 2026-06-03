# CyberTraining — Design System

**Product:** An interactive web-security training lab (SQL Injection, XSS, CSRF, Password Storage).
**Personality:** Dark, technical, "hacker terminal" — but premium, calm, and legible. Neon accents signal energy and danger without becoming noisy. Every visual choice should reinforce *focus on the exploit and its fix*.

---

## 1. Brand & Voice

- **Tone:** Confident, precise, instructional. Short declarative sentences. Treat the reader as a practitioner.
- **Mood:** Late-night security research. Deep near-black canvas, neon-cyan primary, neon-green "live entity" energy, red for danger/vulnerable, green for safe.
- **Golden principle (echoed in product):** *Never trust user input.* The design mirrors this — danger is always clearly color-coded and separated from the secure path.

---

## 2. Color System

Defined as CSS custom properties on `:root`. Use the tokens, never raw hex inline.

### Elevation (surfaces)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#070a10` | Page base (bottom of gradient) |
| `--bg2` | `#0a0e18` | Page base (top of gradient) |
| `--surface` | `#10141f` | Cards, panels, nav |
| `--surface2` | `#171d2b` | Raised elements, inputs-on-panel, comments |
| `--border` | `#212a3e` | Hairline borders, dividers |
| `--code-bg` | `#080b12` | Code blocks, inputs, terminals |

Page background is a fixed two-layer wash: a soft cyan radial glow at top-center over a vertical `bg2 → bg` gradient.

### Accents (neon)
| Token | Hex | Meaning |
|-------|-----|---------|
| `--accent` | `#00e5ff` | Primary — electric cyan. Links, active states, focus, primary CTAs. |
| `--accent-2` | `#18ffb2` | Secondary — neon mint, for gradients. |
| `--neon` | `#2bff88` | The "living entity" green (interactive orb, special highlights). |
| `--danger` | `#ff4d6d` | Vulnerable / attack / error. |
| `--success` | `#2ce98a` | Secure / safe / success. |
| `--warn` | `#ffb13d` | Caution, injected-query highlight. |

Each accent also has an `--*-rgb` triplet (e.g. `--accent-rgb: 0, 229, 255`) for building translucent glows: `rgba(var(--accent-rgb), .15)`.

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `--text` | `#e4ebf7` | Primary text |
| `--muted` | `#7c88a8` | Secondary text, labels, descriptions |

### Usage rules
- **Danger vs Safe must always be distinguishable by more than color** (icon + label + position), for accessibility.
- Neon is for *accents and glow*, never large fills of body text.
- Maintain WCAG AA contrast: body text on surfaces ≥ 4.5:1.

---

## 3. Typography

- **UI font:** `Inter` (weights 400/500/600/700/800), system fallback `Segoe UI, system-ui, sans-serif`.
- **Mono font:** `JetBrains Mono` (400/500/600), fallback `Cascadia Code, Fira Code, ui-monospace, monospace`. Used for all code, queries, hashes, terminal output.
- Loaded via Google Fonts with `display=swap`; fallbacks ensure a clean offline experience.

### Scale
| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Hero H1 | 2.9rem | 800 | Gradient text, `letter-spacing: -.02em` |
| Page H1 | 2rem | 800 | `-.02em` |
| H2 | ~1.5rem | 700 | `-.01em` |
| H3 / panel title | 1rem | 700 | |
| Body | 1rem | 400 | `line-height: 1.6` |
| Small / labels | .82–.85rem | 500 | Often `--muted` |
| Code | .82rem | 400 | mono |

Headlines use tight negative tracking; body stays at default. Gradient text (`white → accent`) is reserved for the hero and logo.

---

## 4. Shape, Depth & Spacing

- **Radii:** `--radius: 12px` (cards/panels), `--radius-sm: 8px` (code/inputs blocks), `--radius-xs: 6px` (buttons, small).
- **Shadows:** soft, dark, large — `0 8px 30px rgba(0,0,0,.45)`; accent glows layered via colored `box-shadow` (e.g. buttons, active pills).
- **Borders:** 1px hairlines in `--border`; state panels add a colored 3px inset side-bar (`inset 3px 0 0 <color>`) plus a faint outer glow.
- **Spacing rhythm:** base unit ~`.25rem`; common gaps `1.25rem` (grid), section padding `2rem`; container `max-width: 1140px`.

---

## 5. Motion & Animation

Motion is **purposeful and subtle**. It guides attention; it never blocks reading.

### Timing tokens
- `--t-fast: .15s ease` — hovers, color/border transitions.
- `--t: .25s cubic-bezier(.4, 0, .2, 1)` — transforms, tab indicator, card lift.

### Catalogue
| Animation | Where | Behaviour |
|-----------|-------|-----------|
| **Card lift** | Lab cards | `translateY(-4px)` + colored glow + top-strip glow on hover. |
| **Tab indicator** | Lab tabs | Underline slides from center to full width (`left/right` transition) with a glow. |
| **Panel fade-in** | Tab panes | `fadeIn` — opacity + 6px upward translate over .3s when a tab activates. |
| **Button** | All `.btn` | `translateY(-1px)` + brightness on hover; press settles to 0. Glow shadow in accent color. |
| **Input focus** | Inputs/textareas | Accent border + 3px translucent accent focus ring. |
| **Orb pulse** | Hero entity | `orbPulse` 3.6s — glow radius + intensity breathe in/out. |
| **Orb ring spin** | Hero entity | `orbSpin` 5s linear — rotating energy ring. |
| **Orb tracking** | Hero entity | JS `requestAnimationFrame` lerp toward cursor (ease .12); scales + comet-stretches with velocity; idle figure-eight drift. |

### The interactive entity ("the orb")
A dark, mouse-responsive neon-green sphere living at the **top of the home page**, behind the hero headline.
- **Look:** dark core (`radial-gradient` to near-black) with a bright neon-green (`--neon`) glow halo + a rotating partial energy ring, floating over a faint masked cyber grid.
- **Behaviour:** follows the cursor with eased motion ("magnetic pull"), grows and stretches in the direction of travel based on speed, and drifts in a slow figure-eight when idle.
- **Performance/A11y:** position via `transform` (GPU-friendly), `pointer-events: none`, paused under `prefers-reduced-motion` (renders static & centered).

### Motion rules
- **Always honor `prefers-reduced-motion: reduce`** — disable non-essential animation, freeze the orb.
- Prefer `transform` and `opacity` (compositor-friendly); avoid animating layout properties.
- Keep durations short (≤ .3s for UI feedback); ambient loops slow and low-contrast.

---

## 6. Components

### Navigation
Sticky top bar, translucent with `backdrop-filter: blur` + saturation, hairline bottom border with faint cyan glow. Gradient-text logo with glow. Nav links are muted pills; active link = cyan text on translucent cyan fill with inset ring.

### Buttons
- `.btn-primary` — cyan→blue gradient, dark text, cyan glow.
- `.btn-danger` — red→orange gradient (attacks / "Attempt login").
- `.btn-success` — green→cyan gradient (secure actions).
- `.btn-ghost` — surface fill, hairline border, cyan border on hover.
- All: gradient fill, hover lift + brightness, visible `:focus-visible` ring. `.btn-sm` for compact.

### Cards (home labs)
Gradient surface, hairline border, **per-lab neon top-strip** (red / amber / cyan / green by position). Hover: lift, colored border, deeper shadow, glowing strip. Badge pill (uppercase, tinted, inset ring) + title + muted description.

### Panels
Container for lab content. Variants `.danger / .success / .warn` add a colored inset side-bar + soft outer glow. Title row supports a status **pill** (`pill-vuln` red / `pill-safe` green).

### Tabs
`Vulnerable / Secure / Explanation` pattern. Center-out sliding glow underline; active pane fades in.

### Code & Output
- `pre` / `.output` — mono, `--code-bg`, hairline border. Output states: `.ok` (green glow), `.err` (red glow), `.warn` (amber).
- `.terminal` wrapper — adds a title bar with red/yellow/green "traffic-light" dots for a console feel.
- `.query-box` — amber left-bar block to surface the live, injected SQL query.

### Callouts
`.callout-blue / -red / -green` — tinted info boxes with a bold lead line. Blue = how-to/info, red = danger/principle, green = safe.

### Specialized
- `.hint-toggle` + `.hint-box` — dashed "Show hint" reveal, mono payload examples.
- `.balance-card` — CSRF lab account rows; amount in glowing green.
- `.hash-row` — password lab; label + green mono hash value.
- `.comment` — XSS lab comment items on `--surface2`.
- `.breadcrumb` — muted, cyan on hover.

---

## 7. Layout & Responsive

- Centered container, `max-width: 1140px`.
- Two-column `.cols` (form ↔ code) collapses to one column at ≤ 720px.
- Lab grid auto-fills `minmax(250px, 1fr)`.
- Mobile: tighter container padding, smaller hero, wrapping nav, smaller orb.

---

## 8. Accessibility

- AA contrast on all text/surfaces.
- Danger/safe never conveyed by color alone (icon + label + side-bar + position).
- `:focus-visible` rings on every interactive element.
- `prefers-reduced-motion` fully respected (UI transitions and the orb).
- `aria-hidden` on purely decorative elements (the orb stage).
- Mono output remains selectable/copyable.

---

## 9. Do / Don't

**Do**
- Use tokens; layer translucent glows from the `--*-rgb` triplets.
- Keep danger (red) and safe (green) visually and spatially separated.
- Animate `transform`/`opacity`; keep UI feedback ≤ .3s.
- Let the deep background and generous spacing carry the calm; let neon do the pointing.

**Don't**
- Fill large areas with saturated neon or animate body text.
- Convey state with color only.
- Add motion that delays interaction or ignores reduced-motion.
- Hardcode hex values in components.
