import { describe, expect, it } from 'vitest';
import todo from '../TODO.md?raw';
import done from '../DONE.md?raw';

/**
 * TODO.md holds only open work; finished items move to DONE.md as a short
 * summary (see CLAUDE.md → "TODO and DONE").
 */
const lines = todo.split('\n');

describe('TODO.md / DONE.md', () => {
  it('DONE.md exists', () => {
    expect(done.startsWith('# Erledigt')).toBe(true);
  });

  it('TODO.md has no ticked or crossed-out items – move them to DONE.md', () => {
    expect(lines.filter((l) => /^\s*- \[[xX]\]/.test(l) || /^\s*- \[ \]\s*~~/.test(l))).toEqual([]);
  });

  it('TODO.md has no "Erledigt" paragraphs or finished sections – they belong in DONE.md', () => {
    expect(lines.filter((l) => /^Erledigt\b/.test(l) || /^#.*(abgeschlossen|erledigt)/i.test(l))).toEqual([]);
  });
});
