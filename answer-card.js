// Renders a composed assistant answer. All text is assigned with textContent,
// and only web, mail, phone, in-page and resume PDF links are rendered.
const SAFE_LINK = /^(?:https?:\/\/|mailto:|tel:|#[\w-]+$|[\w-]+\.pdf$)/i;
const VISIBLE_ITEMS = 3;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link({ label, href }) {
  if (!SAFE_LINK.test(href)) return element("span", "answer-link", label);
  const anchor = element("a", "answer-link", label);
  anchor.href = href;
  if (/^https?:/i.test(href)) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  } else if (/\.pdf$/i.test(href)) {
    anchor.setAttribute("download", "");
  }
  return anchor;
}

function renderItem(item) {
  const entry = element("li", "answer-item");
  entry.append(element("p", "answer-item-title", item.title));
  if (item.meta) entry.append(element("p", "answer-item-meta", item.meta));
  if (item.text) entry.append(element("p", "answer-item-text", item.text));
  if (item.details.length) {
    const details = element("dl", "answer-details");
    item.details.forEach(({ label, text }) => details.append(element("dt", "", label), element("dd", "", text)));
    entry.append(details);
  }
  if (item.chips.length) {
    const chips = element("ul", "answer-chips");
    item.chips.forEach((chip) => chips.append(element("li", "", chip)));
    entry.append(chips);
  }
  if (item.links.length) {
    const links = element("p", "answer-links");
    item.links.forEach((entryLink) => links.append(link(entryLink)));
    entry.append(links);
  }
  return entry;
}

export function renderAnswerCard(card, { onFollowUp = () => {}, onSource = () => {}, copy = (text) => navigator.clipboard.writeText(text) } = {}) {
  const root = element("div", `chat-message assistant-message answer-card answer-${card.kind}`);
  if (card.lead) root.append(element("p", "answer-lead", card.lead));
  (card.paragraphs || []).forEach((paragraph) => root.append(element("p", "answer-paragraph", paragraph)));
  if (card.note) root.append(element("p", "answer-note", card.note));

  if (card.items.length) {
    const list = element("ul", "answer-items");
    const entries = card.items.map(renderItem);
    entries.slice(VISIBLE_ITEMS).forEach((entry) => { entry.hidden = true; });
    list.append(...entries);
    root.append(list);
    const hidden = entries.length - VISIBLE_ITEMS;
    if (hidden > 0) {
      const more = element("button", "answer-more", `Show ${hidden} more`);
      more.type = "button";
      more.addEventListener("click", () => {
        entries.forEach((entry) => { entry.hidden = false; });
        more.remove();
        // The button disappears, so move focus to the first revealed item.
        const firstRevealed = entries[VISIBLE_ITEMS].querySelector(".answer-item-title");
        firstRevealed.tabIndex = -1;
        firstRevealed.focus();
      });
      root.append(more);
    }
  }

  if (card.kind !== "greeting" && card.kind !== "refusal") {
    const footer = element("div", "answer-footer");
    if (card.sources.length) {
      const sources = element("p", "answer-sources", "From ");
      card.sources.forEach(({ label, href }, index) => {
        const anchor = element("a", "", label);
        anchor.href = href;
        anchor.addEventListener("click", (event) => {
          event.preventDefault();
          onSource(href);
        });
        if (index) sources.append(" · ");
        sources.append(anchor);
      });
      footer.append(sources);
    }
    const copyButton = element("button", "answer-copy", "Copy");
    copyButton.type = "button";
    copyButton.setAttribute("aria-label", "Copy answer");
    copyButton.addEventListener("click", async () => {
      try {
        await copy(card.text);
        copyButton.textContent = "Copied";
      } catch {
        copyButton.textContent = "Couldn't copy";
      }
      setTimeout(() => { copyButton.textContent = "Copy"; }, 2000);
    });
    footer.append(copyButton);
    root.append(footer);
  }

  if (card.followUps.length) {
    const followUps = element("div", "answer-followups");
    followUps.setAttribute("aria-label", card.kind === "refusal" ? "Questions about Sujal" : "Suggested follow-up questions");
    card.followUps.forEach((question) => {
      const button = element("button", "", question);
      button.type = "button";
      button.addEventListener("click", () => onFollowUp(question));
      followUps.append(button);
    });
    root.append(followUps);
  }
  return root;
}
