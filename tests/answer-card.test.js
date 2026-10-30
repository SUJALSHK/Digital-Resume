// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderAnswerCard } from '../answer-card.js';

const item = (overrides = {}) => ({ title: 'Project', meta: '', text: '', chips: [], links: [], details: [], ...overrides });
const card = (overrides = {}) => ({
  kind: 'answer', lead: 'These projects match:', note: '', items: [item()], sources: [], followUps: [], text: 'plain text', ...overrides,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('answer card', () => {
  it('renders record text as text, never as HTML', () => {
    const node = renderAnswerCard(card({ lead: '<b>lead</b>', items: [item({ title: '<img src=x onerror=alert(1)>', chips: ['<script>'] })] }));
    expect(node.querySelector('img, script, b')).toBeNull();
    expect(node.querySelector('.answer-item-title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(node.querySelector('.answer-lead').textContent).toBe('<b>lead</b>');
  });

  it('renders only safe links and opens web links in a new tab', () => {
    const node = renderAnswerCard(card({ items: [item({ links: [
      { label: 'Live site', href: 'https://example.com' },
      { label: 'Bad', href: 'javascript:alert(1)' },
      { label: 'Email', href: 'mailto:sujal.shakya@mnsu.edu' },
      { label: 'Download PDF', href: 'Sujal_Shakya_Resume1.pdf' },
    ] })] }));
    const anchors = [...node.querySelectorAll('.answer-links a')];
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(['Live site', 'Email', 'Download PDF']);
    expect(anchors[0].target).toBe('_blank');
    expect(anchors[0].rel).toBe('noopener noreferrer');
    expect(anchors[1].target).toBe('');
    expect(anchors[2].hasAttribute('download')).toBe(true);
    expect(node.querySelector('.answer-links span').textContent).toBe('Bad');
  });

  it('shows three items, then reveals the rest and moves focus to them', () => {
    const node = renderAnswerCard(card({ items: Array.from({ length: 5 }, (_, index) => item({ title: `Item ${index}` })) }));
    document.body.append(node);
    const entries = [...node.querySelectorAll('.answer-item')];
    expect(entries.filter((entry) => entry.hidden)).toHaveLength(2);
    const more = node.querySelector('.answer-more');
    expect(more.textContent).toBe('Show 2 more');
    more.click();
    expect(entries.every((entry) => !entry.hidden)).toBe(true);
    expect(node.querySelector('.answer-more')).toBeNull();
    expect(document.activeElement.textContent).toBe('Item 3');
    node.remove();
  });

  it('copies the plain-text answer and reports failures', async () => {
    const copy = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('denied'));
    const node = renderAnswerCard(card(), { copy });
    const button = node.querySelector('.answer-copy');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Copied'));
    expect(copy).toHaveBeenCalledWith('plain text');
    vi.advanceTimersByTime(2000);
    expect(button.textContent).toBe('Copy');
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe("Couldn't copy"));
  });

  it('sends follow-up questions and opens cited sections', () => {
    const onFollowUp = vi.fn();
    const onSource = vi.fn();
    const node = renderAnswerCard(card({ followUps: ['What are his skills?'], sources: [{ label: 'Projects', href: '#projects' }] }), { onFollowUp, onSource });
    node.querySelector('.answer-followups button').click();
    expect(onFollowUp).toHaveBeenCalledWith('What are his skills?');
    const source = node.querySelector('.answer-sources a');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    source.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onSource).toHaveBeenCalledWith('#projects');
  });

  it('keeps refusals short: no footer, only suggested questions', () => {
    const node = renderAnswerCard(card({ kind: 'refusal', lead: 'I can only answer questions about Sujal.', items: [], followUps: ['When will he graduate?'] }));
    expect(node.querySelector('.answer-footer')).toBeNull();
    expect(node.querySelector('.answer-followups').getAttribute('aria-label')).toBe('Questions about Sujal');
  });
});
