import { cp, mkdir, rm } from "node:fs/promises";

// Preserve the native HTML/CSS/ES-module app and its existing relative URLs.
const files = [
  "index.html", "styles.css", "script.js", "assistant-config.js", "assistant-policy.js", "chat-ui.js", "answer-card.js", "project-carousel.js",
  "assets", "DeveloperPortfolio.png", "linkdin photo.png", "Sujal_Shakya_Resume1.pdf",
];
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
for (const file of files) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url), { recursive: true });
}
console.log("Built static resume in dist/");
