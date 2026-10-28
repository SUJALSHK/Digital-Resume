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
