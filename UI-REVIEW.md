# Editorial resume and mobile chat review

Work lives on `ui/editorial-resume`. The previous assistant restrictions were preserved in baseline commit `32e6304`; this redesign changes presentation and chat-container behavior. No push to `main`, production deployment, Vercel configuration, domain, rewrite or Supabase setting is part of this review. Remote preview status is reported in the chat handoff.

## Before and after

The previous interface used navy gradients, glowing borders, nested panels, pill labels and an animated project carousel. Its chat appeared below the resume on smaller screens and still described itself as a future preview.

The new interface uses a neutral canvas, Source Sans 3, muted green links, natural page scrolling, plain skill groups, project list rows and section rules. Original resume wording and data are preserved; project summaries display their existing first sentence. The working chat now has current product copy.

- [Before: desktop, dark](docs/ui-review/before-desktop-dark.webp)
- [After: desktop, dark](docs/ui-review/after-desktop-dark.webp)
- [After: phone, dark](docs/ui-review/after-mobile-dark.webp)
- [After: phone, light](docs/ui-review/after-mobile-light.webp)

## Files

- `index.html`: semantic sections, plain navigation, optimized portrait, current chat copy, one shared chat component, textarea, scrim and launcher. The exact PDF filename remains `Sujal_Shakya_Resume1.pdf`.
- `styles.css`: editorial design tokens, both themes, responsive layouts, keyboard focus, reduced motion and print rules.
- `script.js`: simplified rendering templates, safe theme persistence, textarea keyboard handling and presentation hooks. Removed the carousel's clone DOM, autoplay and drag handling. WebLLM initialization, Supabase queries and resume data are unchanged.
- `chat-ui.js`: launcher, sheet, focus management, history entry, scroll lock/restore, viewport keyboard handling, progress and calm fallback notices. It imports no AI/data code and never starts inference.
- `assets/fonts/`: self-hosted 29 KB Source Sans 3 Latin variable font and its license. Preload plus `font-display: optional` avoids a late font swap.
- `assets/images/profile/sujal-shakya.jpg`: 25 KB portrait derived from the existing photo; its intrinsic dimensions reserve layout space. Original assets are preserved.
- `assets/icons/favicon.svg`: neutral background and the same green accent.
- `scripts/build.mjs`, `scripts/preview.mjs`, `package.json`, `package-lock.json`: include the UI module, serve only `dist`, and add jsdom for development tests. No runtime UI dependency was added.
- `tests/chat-ui.test.js`: sheet interactions, responsive state, history, scroll, keyboard viewport, draft/message preservation, theme preference/storage failure, progress and data-error presentation.
- `README.md`, this report and `docs/ui-review/`: run instructions and review evidence.

## Tokens and breakpoints

Colors live in `:root` and `[data-theme="dark"]`. Dark uses background `#0f1115`, surface `#161920`, text `#e6e8eb`, muted `#9aa1ab`, hairline `#262a31` and accent `#3fb27f`. Light uses background `#fafaf9`, surface `#ffffff`, text `#1a1c20`, muted `#5d636c`, hairline `#e4e4e1` and accent `#1f7a55`. A separate neutral control-line token provides at least 3:1 control-boundary contrast; hairlines are decorative dividers.

Text contrast is at least 5.29:1 for the checked accent/muted/body combinations; control boundaries are at least 3.48:1. Spacing tokens are 4/8/12/16/24/32/48/64px. The base is 16px/1.6, names are 44px desktop and 32px phone, headings are 22px, and transitions are 180ms. Corners are 6–8px, with no gradients, glow, blur or shadows.

At 1024px and above, a content column up to about 760px sits beside a 380px sticky chat panel (360px at narrow desktop widths). Below 1024px, the floating launcher opens the same component as a sheet up to 90dvh. The header and stacked phone rows change below 640px. Photo and name remain on the same row. Short viewports and visual-keyboard heights below 560px collapse secondary chat copy/suggestions so the composer remains visible.

The launcher uses safe-area offsets, a 52px target and a label that collapses on scroll, first open or six seconds. The close and send buttons are 44px. A same-URL history entry makes Back close the sheet; Escape, the close button and scrim also work. Background content becomes inert, focus stays inside the sheet, and closing restores focus and page position. Resizing changes presentation without remounting chat or model state.

## Verification

- `npm test`: 103 passing tests (86 assistant tests retained plus 17 UI/theme cases).
- `npm run build`: succeeds and produces `dist`. Browser and Lighthouse checks use `npm run preview`, serving that output.
- Lighthouse accessibility: **100 for all 12 combinations** of 360×740, 390×844, 430×932, 768×1024, 1024×768 and 1440×900 in dark/light. [Machine-readable summary](docs/ui-review/lighthouse-summary.json). Screenshots were inspected for layout and both theme preferences were explicitly applied.
- Audit logs: zero page-load model requests, zero JavaScript exceptions and no reported console errors. Opening the sheet also starts no model work. The module-level engine and Supabase fetch functions match the saved baseline.
- Safari manual checks: sheet opening, keyboard navigation, Enter sending, Shift+Enter newline, initial-suggestion dismissal, browser Back closing and close/reopen conversation preservation. Supported questions trigger the existing public Supabase reads and model loading; progress is displayed separately from messages.
- The exact PDF URL responds `200 application/pdf` with a valid PDF header.
- Automated tests cover unavailable WebGPU/model failure fallback, breakpoint state preservation, simulated keyboard viewport resizing, all close methods, focus trapping and scroll restoration.

Actual iOS and Android hardware were unavailable. Device keyboard animation, notched-device safe areas, Android hardware Back and physical rotation still need a device pass; emulation and unit tests do not establish those hardware results. Lighthouse is an automated accessibility check, not a full accessibility certification.

The one-time model notice is based on the model's [published weight manifest](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/raw/main/ndarray-cache.json), which lists 695,242,752 parameter bytes; the UI rounds to about 700 MB and notes extra runtime files.

## Copy and data issues preserved for approval

- The existing headline is too long to remain one line at narrow widths. Suggested shorter copy: “Computer Science Student | Software Developer.” It was not substituted.
- Visible experience says “M eathon Trucking Company”; education and Supabase say “M Eaton Trucking LLC.” The spelling was not changed.
- Visible sections use local `resumeData`; Supabase currently supplies the assistant's public records. The visible four projects and broad skills list differ from the public database's one project and eleven skills. This UI task did not reconcile sources or change queries.
- The local education project says work is ongoing, while the public experience row has `is_current: false` with an end date of December 10, 2026. That source inconsistency needs owner review.
- Specific internship preferences, AWS certification and Ghost Student are absent from current public records. No facts were added.
- The profile summary partly repeats the long headline. Any editorial rewrite should be approved separately.

Suggested next steps: review the preview and these copy issues, test on physical phones, then approve a production merge separately.

## Second pass: navigation, hero actions and project cards

Audit priorities, highest user impact first: no primary call to action above the fold; no in-page wayfinding (the header "Projects" link left the site); project screenshots existed but were not shown; comma-separated skills were hard to scan; the photo floated away from the name; the page ended without a contact prompt or footer.

- **Header:** sticky, with in-page section links whose active state follows scrolling (`aria-current="location"`). GitHub, LinkedIn and the portfolio site are icon links with accessible names; the off-site link is labelled "Portfolio site". Below 1024px everything moves into the menu.
- **Hero:** availability badge, photo beside the name, "Email Sujal" primary action, résumé download and "View projects" secondary actions, plus a facts row (degree, expected graduation, location) drawn from existing data.
- **Content:** skills render as chips in two columns; projects are cards with lazy-loaded 800px WebP screenshots, technology chips and "Live site"/"Source" links whose accessible names start with the visible text; education entries are cards with labelled details; contact is a closing panel with a primary action; a footer links back to top.
- **System additions:** `--accent-strong`, `--chip-bg`, `--chip-text`, `--media-bg`, a 12px large radius and a 320ms slow transition. Hover feedback is limited to colour, border and a 2.5% image scale; reduced motion disables all of it.
- **Unchanged:** chat markup, IDs and behaviour; resume wording and data. The copy issues listed above remain for owner approval.

Verification: 103 tests pass; Lighthouse (desktop and mobile) scores 100 for performance, accessibility, best practices and SEO, with mobile LCP 0.9s and CLS 0. Screenshots were checked at 1440, 1100, 768 and 390px in both themes, including the open phone menu.

## Project carousel

`project-carousel.js` turns the Projects cards into an infinite carousel that advances every 1000ms with a 450ms slide, so each position rests about half a second. The track holds the real cards followed by clones of all of them; after sliding into the clones it snaps back one set with transitions disabled, which looks identical. Cards per view come from a container query on the carousel's own width (1 below 520px, 2 below 900px, 3 above); in the current layout that is two on desktop and tablet and one on phones.

- **Pausing:** mouse hover, keyboard focus inside the carousel (except on the pause button, so Start works), a hidden tab, the section being off screen, an active swipe, the visible pause button (WCAG 2.2.2), and `prefers-reduced-motion`, which starts paused but still allows manual navigation or Play.
- **Accessibility:** follows the WAI carousel pattern with `aria-roledescription` carousel/slide, "n of 4" slide labels, `aria-live` off while rotating and polite when paused, and labelled dot buttons. Clones are `aria-hidden` with their links removed from the tab order. Focusing an off-screen card brings it into view.
- **Input:** previous/next and dot buttons ignore presses while a slide is moving, which prevents half-finished animations. Touch and pen swipes follow the finger and snap past a 48px threshold; vertical scrolling is preserved, and the click that ends a swipe is cancelled.
- **Cleanup:** all listeners share one `AbortController`; `destroy()` also clears both timers and disconnects the observer.

`tests/project-carousel.test.js` covers timing, the seamless loop, every pause reason, reduced motion, swipe and cleanup. Lighthouse remains 100 in all categories on desktop and mobile.

## Compact layout pass

Goal: less scrolling without cramping. Whitespace came from five places: a hero that stacked photo, badge, title, summary, actions and facts with 32–40px gaps; 80px section gaps plus 32px heading margins; a 104px experience date column that narrowed the text; a two-column skills grid with uneven rows; and a fixed 720px chat panel that was mostly empty.

- **Width:** the page is up to 1280px wide; the chat column is 360px (340px at 1024–1199px). Paired content responds to the content column's own width (`container: pane`), not the viewport.
- **Hero:** photo beside the whole text column, badge on the name row, 8px between the name, title and summary, and a facts row whose short columns size to their content.
- **Sections:** 48px apart (40px on phones) with 20px under headings. Experience and education are cards that sit side by side when the content column is at least 720px wide; the experience date sits on the title row. Skills use balanced CSS columns (3, 2 or 1), so long groups no longer leave gaps. Project images use 16:9, and the carousel shows three cards when its width is at least 820px. Contact details form a 2×2 grid.
- **Chat:** the desktop panel and the mobile sheet size to their content and cap at the available height; the conversation scrolls inside once it fills that height. Suggestions sit directly above the input.
- **Loading:** `script.js` now imports the Supabase client on the first data request instead of at module load, so the resume renders without waiting on the CDN. Queries, caching and fallbacks are unchanged.

| Viewport | Page height before | After |
|---|---|---|
| 1440×900 | 3,694px | 2,604px (−30%) |
| 1280×800 | 3,694px | 2,667px (−28%) |
| 1100×800 | 3,928px | 3,241px (−17%) |
| 768×1024 | 3,766px | 3,233px (−14%) |
| 390×844 | 4,756px | 4,119px (−13%) |

The empty chat panel went from 720px to 456px on desktop and the phone sheet from about 760px to 510px. Experience now starts at 457px instead of 671px at 1440px. Verification: 111 tests pass; Lighthouse is 100 for all four categories on desktop and mobile with CLS 0 (previously 0.011); a headless question loaded all three Supabase sources through the lazy client and reached model loading.

## Ivory, emerald and vermilion palette

The palette is warm ivory `#F9EBD7`, emerald `#046A38` and vermilion `#E34222`, defined as tokens in `:root` and `[data-theme="dark"]`. Roughly 70% is ivory or charcoal surfaces, 20% emerald (headings, buttons, links, experience rules, skill labels, the contact block) and 10% vermilion (section markers, the period after the name, the hero corner mark, the top edge of the assistant card, project link arrows and focus rings).

| Role | Light | Dark | Contrast |
|---|---|---|---|
| Background / card | `#F9EBD7` / `#FDF7EE` | `#13110E` / `#1E1B17` | — |
| Text | `#1F1A14` | `#F9EBD7` | 14.7:1 / 16.1:1 |
| Muted text | `#5F5446` | `#B8AC99` | ≥5.6:1 on every surface |
| Emerald text, links | `#046A38` | `#4FC38A` | 5.7:1 / 8.5:1 |
| Emerald button fill and text | `#046A38`, ivory text | `#0B7A44`, `#FFF6EA` text | 5.7:1 / 4.6:1 |
| Vermilion decoration / small text | `#E34222` / `#B5321A` | `#E34222` / `#F26A4B` | 3.5:1 non-text / 5.2:1 / 6.2:1 |
| Contact block | `#046A38`, ivory text | `#0D4A2C`, ivory text | 5.7:1 / 8.8:1 |

- Raw emerald is only 2.8:1 on the dark background, so dark mode separates `--accent` (text) from `--accent-fill` (button backgrounds).
- Vermilion is 3.5:1 on ivory, enough for graphics and large text but not small text, so small vermilion text uses `--highlight-text`. Vermilion never sits on emerald (1.6:1); inside the contact block, markers and focus rings switch to ivory.
- Headings use a system serif stack (`Iowan Old Style`, `Palatino Linotype`, Georgia); body text stays Source Sans 3. Nothing is downloaded. The serif varies by platform: Iowan on Apple devices, Palatino on Windows, and Georgia or a system serif elsewhere.
- The hero is a lighter card on the ivory page, and the contact section is a solid emerald block, which gives the page colour blocking at its start and end.
- The favicon and the browser theme colour (`theme-color`) use the new palette.

Verification: 111 tests pass; Lighthouse accessibility is 100 on desktop and mobile in both themes, which includes the colour-contrast audit. Screenshots were checked at 1440px and 390px in both themes.
