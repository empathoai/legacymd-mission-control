# LegacyMD branding

Recorded 2026-11-19. This is the source of truth for colour, type and radius in the app and in
generated documents (PDF reports).

## Colors

| Token | Hex | Use |
|---|---|---|
| Primary | `#CEAD3C` | Primary actions, active state, ring, links |
| Secondary | `#17253D` | Headings, secondary buttons, dark surfaces |
| Accent | `#CEAD3C` | Highlights; surfaces use a light tint (`#F3EBD5`) so hovers stay calm |
| Background | `#F9F8F6` | App background |
| Text primary | `#5B6675` | Body copy |
| Link | `#CEAD3C` | Links, same as primary |
| Border | `#E3DFD5` | Hairlines |
| Destructive | `oklch(0.577 0.245 27.325)` | Errors, overdue |

Dark theme: background `#0F1826`, card `#16202F`, text `#C9CFD8`, headings `#F9F8F6`, gold
unchanged, muting via `#8D97A6`.

## Fonts

- **Body:** Inter (`--font-sans`), already loaded through `next/font`.
- **Headings:** Playfair Display (`--font-playfair`), loaded in `app/layout.tsx` and applied to
  `h1`–`h4` in `app/globals.css`.

## Typography scale

| Level | Size | Font |
|---|---|---|
| h1 | 60px | Playfair Display |
| h2 | 30px | Playfair Display |
| body | 18px | Inter |

**Deviation inside the app:** page titles use the h2 size (30px), but body copy stays at 16px.
At 18px the data tables (nine columns in the patient report) overflow and the clinic loses the
one-screen view. The 18px body applies to marketing and long-form pages, not to the grids. If
the owner wants 18px everywhere, it is one line in `globals.css`.

## Spacing and shape

- Base unit: 4px.
- Border radius: 4px (`--radius: 0.25rem`), so cards, buttons and inputs are nearly square.

## Personality

Professional, medium energy, written for patients and healthcare professionals. Copy is plain,
specific and free of superlatives.

## Where it lives

- `web/app/globals.css` — colour tokens, radius and heading font.
- `web/app/layout.tsx` — the two font families.
- `web/public/logo-legacymd.webp` — the mark, gold L on a dark square.
- Generated PDFs reuse the same colours and the logo.
