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

## Assistant restrictions

- `assistant-config.js` centralizes the fixed refusal, three suggested questions, greetings, topic/synonym lists, injection/prohibited-action patterns, and retrieval/generation limits.
- `assistant-policy.js` classifies each request before engine access. It uses lexical BM25-style retrieval, admits resume questions and application-tagged follow-ups, and refuses unrelated requests. Mixed concept/use questions retain only the question about Sujal's use.
- Only the top four relevant records enter the structured model context. The prompt preserves third person, exact proficiency, project-specific technology relationships, and ongoing/scheduled work status. The model selects verified sentences rather than composing unrestricted prose.
- Completed output is buffered and checked for code, first person, unsupported entities and claims. Every accepted sentence must match retrieved evidence. Code receives the fixed refusal; other invalid output receives a deterministic answer from the retrieved facts. The UI never renders raw model output.
- History retains six messages, with the topic attached to in-scope assistant turns. Refusals and greetings clear it. Repeated follow-ups carry the original topic without growing it indefinitely.
- Missing WebGPU, model loading/generation failures and invalid output use retrieved resume records. Public Supabase projects, skills and experience remain authoritative when available; the existing static resume provides education/contact and offline records. No matching evidence produces `The portfolio doesn't provide that information.`

## Tuning

Start in `ASSISTANT_CONFIG`: `retrieval.minScore` is `0.8`, `maxItems` is `4`, BM25 `k1` is `1.2`, `b` is `0.75`, and the exact-name boost is `3`. Generation uses temperature `0.15`, `max_tokens: 200` and `stream: false`. Responses contain at most four evidence sentences, with individual facts limited to 55 words. Changing keyword lists or thresholds should be accompanied by relevant test cases.

## Verification and limits

The Vitest suite covers the requested scope cases, injection and mixed requests, graduation in May 2028, unknown certifications/technologies/employers/projects, follow-up history, third person, code/claim validation and inference failures. It uses the actual static resume plus representative Supabase fixtures. Run `npm test` for the current count.

Browser checks on October 27, 2026 used Brave with WebGPU and confirmed WebLLM's `Model loaded!` message. The built app refused all ten requested off-topic examples and post-refusal follow-ups, rendered three refusal suggestions, and answered language, M Eaton, graduation, leadership and in-scope follow-up questions from records. It returned missing information for internship preferences, AWS certification and Ghost Student, which are absent from the current public records. Greetings and thanks used canned replies. A false missing-information result on the mixed React Native question led to an additional tested fallback for retrieved facts; a final Safari check confirmed the corrected answer only named Sujal's project technologies. Clicking a refusal suggestion successfully submitted the graduation question and returned May 2028. WebGPU absence, loading failures and inference failures are simulated in automated tests.

The gate deliberately supports conservative English phrasing. Unsupported scripts are refused except for recognized greetings; lexical rules cannot identify every disguised or multilingual instruction. The independent exact-evidence output check constrains displayed answers to approved resume facts even if classification or the model errs. This restriction also limits natural paraphrasing, may refuse valid unusual wording, and may repeat facts on follow-ups. Data is cached for the page session; stale or incomplete source records remain a limitation. Missing details should be added to approved records rather than inferred by the model.

No deployment, custom domain, Vercel setting, rewrite or Supabase setting was changed. This checkout contains no Vercel configuration file; `dist` is the build output. Recommended next steps are to add approved internship preferences and any missing project/leadership details, then repeat the tests before deployment.
