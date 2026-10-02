import { describe, expect, it } from 'vitest';
import { errorText } from '@ui/errors';
import { SaveError } from '@core/save';

describe('errorText (player-facing error messages)', () => {
  it('keeps our own German errors and translates browser errors', () => {
    expect(errorText(new SaveError('Spielstand ist beschädigt.'))).toBe('Spielstand ist beschädigt.');
    expect(errorText(new TypeError('Failed to fetch'))).toBe('Keine Verbindung zum Server.');
    expect(errorText(new DOMException('denied', 'NotAllowedError'))).toBe('Der Browser hat das nicht erlaubt.');
    expect(errorText(new DOMException('full', 'QuotaExceededError'))).toBe('Der Speicher des Geräts ist voll.');
    expect(errorText(new RangeError('Invalid array length'))).toBe('Unerwarteter Fehler (RangeError).');
    expect(errorText('kaputt')).toBe('Unerwarteter Fehler.');
  });
});
