# Sujal Shakya's Digital Resume

Native HTML, CSS and JavaScript with public Supabase resume records and browser-local WebLLM/WebGPU inference (`Llama-3.2-1B-Instruct-q4f16_1-MLC`). No hosted AI API is used.

## Run and verify

```sh
npm ci
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/` to inspect the production output. The build copies the existing static app and required assets to `dist`; it adds no framework. Serve over localhost or HTTPS for WebGPU. The browser downloads the model on its first supported question; opening the mobile chat, greetings and refusals do not load it.

The editorial layout uses a sticky desktop chat panel at 1024px and above and the same component in a mobile bottom sheet below that breakpoint. See [the UI review](UI-REVIEW.md) for design tokens, screenshots, verification, and unchanged copy/data issues.

## Resume content

`Sujal_Shakya_Resume1.pdf` is the source of truth. Visible sections come from `resumeData` in `script.js`. The assistant reads public Supabase projects, skills and experience when they load, falling back to `resumeData` if a request fails; education, leadership and contact always come from `resumeData`. When the PDF changes, update `resumeData`, then apply a reviewed SQL script like `docs/supabase/2026-10-29-resume-sync.sql`. It backs up the tables, can be rerun safely, and has a matching rollback.

## Assistant restrictions

- `assistant-config.js` centralizes the fixed refusal, three suggested questions, greetings, topic/synonym lists, injection/prohibited-action patterns, and retrieval/generation limits.
- `assistant-policy.js` classifies each request before engine access. It uses lexical BM25-style retrieval, admits resume questions and application-tagged follow-ups, and refuses unrelated requests. Mixed concept/use questions retain only the question about Sujal's use. Loose introductions ("tell us something about Sujal", "Who's Sujal?") are answered with an overview.
- Every prompt carries a compact portfolio brief (`portfolioBrief`: education, roles with their strongest result, leadership, newest projects, skill groups) plus up to four records most relevant to the question and the last four in-scope messages. The prompt stays under about 10,000 characters to fit the model's 4,096-token window; older history is dropped first.
- The system prompt asks for a direct, conversational answer in third person that connects skills to the roles and projects where they were used, describes a testing role as testing rather than building, and says when the portfolio does not mention something. It rules out lists, praise, and claims about personality, reputation or plans. The format rules are repeated after the question, which a 1B model follows most closely.
- `checkProse` checks each reply before display. Capitalized and technical names, whole numbers and claim words (certified, award, graduated, recognition, passionate, "aims to", and similar) must appear in the portfolio or the visitor's question. Lists and `Label:` lines, first person, code, markup, and a claim that he built a mobile app (his mobile work is testing) are rejected. A sentence naming a project or role may credit it only with technologies, "mobile" or "AI" that its record mentions. Markdown, repeated sentences, closing questions and a sentence cut off by the token limit are removed. A failed reply is retried once at a lower temperature, then replaced by an answer composed from the records.
- Open-ended questions (hiring, strengths, fit, "summarize his background") draw on roles, leadership, projects and education. Follow-ups such as "Tell me more about the project you just mentioned" resolve to the first matching record named in the most recent answer that names one. A question about a technology "not listed" in his portfolio says the portfolio cannot confirm it and shows the skills it lists.
- `composeAnswer` is the record-only path used without WebGPU, after a failed reply, and for missing information. It writes a short overview for open-ended questions and grouped items otherwise. `answer-card.js` renders every answer with `textContent` only and allows web, mail, phone, in-page and resume PDF links.
- History retains six messages, with the topic attached to in-scope assistant turns. Refusals and greetings clear it. Repeated follow-ups carry the original topic without growing it indefinitely.
- Missing WebGPU and model loading or generation failures compose the answer from the retrieved records. Public Supabase projects, skills and experience remain authoritative when available; the existing static resume provides education/contact and offline records. No matching evidence produces `The portfolio doesn't provide that information.`, followed by what the portfolio does list for that topic.

## Tuning

Start in `ASSISTANT_CONFIG`: `retrieval.minScore` is `0.8`, `maxItems` is `4`, BM25 `k1` is `1.2`, `b` is `0.75`, and the exact-name boost is `3`. Generation uses temperature `0.3`, `top_p: 0.9`, `frequency_penalty: 0.3`, `max_tokens: 200` and `stream: false`; the retry uses temperature `0.15`. Context limits live in `ASSISTANT_CONFIG.context`. Individual facts are limited to 55 words. Changing keyword lists or thresholds should be accompanied by relevant test cases.

## Verification and limits

The Vitest suite covers the requested scope cases, injection and mixed requests, graduation in May 2028, unknown certifications/technologies/employers/projects, follow-up history, third person, code/claim validation and inference failures. It uses the actual static resume plus representative Supabase fixtures. Run `npm test` for the current count.

Browser checks on October 27, 2026 used Brave with WebGPU and confirmed WebLLM's `Model loaded!` message. The built app refused all ten requested off-topic examples and post-refusal follow-ups, rendered three refusal suggestions, and answered language, M Eaton, graduation, leadership and in-scope follow-up questions from records. It returned missing information for internship preferences, AWS certification and Ghost Student, which are absent from the current public records. Greetings and thanks used canned replies. A false missing-information result on the mixed React Native question led to an additional tested fallback for retrieved facts; a final Safari check confirmed the corrected answer only named Sujal's project technologies. Clicking a refusal suggestion successfully submitted the graduation question and returned May 2028. WebGPU absence, loading failures and inference failures are simulated in automated tests.

The gate deliberately supports conservative English phrasing. Unsupported scripts are refused except for recognized greetings; lexical rules cannot identify every disguised or multilingual instruction. The independent exact-evidence output check constrains displayed answers to approved resume facts even if classification or the model errs. This restriction also limits natural paraphrasing, may refuse valid unusual wording, and may repeat facts on follow-ups. Data is cached for the page session; stale or incomplete source records remain a limitation. Missing details should be added to approved records rather than inferred by the model.

No deployment, custom domain, Vercel setting, rewrite or Supabase setting was changed. This checkout contains no Vercel configuration file; `dist` is the build output. Recommended next steps are to add approved internship preferences and any missing project/leadership details, then repeat the tests before deployment.
