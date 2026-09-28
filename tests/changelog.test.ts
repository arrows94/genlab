import { describe, expect, it } from 'vitest';
import { CHANGELOG, CURRENT_RELEASE, hiddenText, parseChangelog, visibleNews, type ChangelogEntry } from '@ui/changelog';
import { content } from './helpers';

describe('changelog', () => {
  it('is newest first with unique ids and known features', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(new Set(ids).size).toBe(ids.length);
    expect(CURRENT_RELEASE).toBe(ids[0]);
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
      for (const i of e.items) if (i.feature) expect(content.features.has(i.feature), `${e.id}: ${i.feature}`).toBe(true);
    }
  });

  it('hides items about locked features and only counts them', () => {
    const entries: ChangelogEntry[] = [
      { id: 3, date: '2026-10-02', title: 'C', items: [{ text: 'secret', feature: 'tower' }] },
      { id: 2, date: '2026-10-01', title: 'B', items: [{ text: 'open' }, { text: 'hidden', feature: 'aeon' }] },
      { id: 1, date: '2026-09-28', title: 'A', items: [{ text: 'old' }] },
    ];
    const news = visibleNews(entries, 1, (f) => f === 'breeding');
    expect(news.map((e) => e.id)).toEqual([3, 2]);
    expect(news[0]).toMatchObject({ items: [], hidden: 1 });
    expect(news[1]).toMatchObject({ items: ['open'], hidden: 1 });
    expect(visibleNews(entries, 3, () => true)).toEqual([]);
    expect(hiddenText(2)).toContain('2 Verbesserungen');
  });

  it('accepts only well-formed downloaded notes', () => {
    expect(parseChangelog(null)).toEqual([]);
    expect(parseChangelog([{ id: 'x' }, ...CHANGELOG])).toEqual(CHANGELOG);
  });
});
