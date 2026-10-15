import { describe, expect, it } from 'vitest';
import { formString, parseItemsJson } from './form';

describe('form helpers', () => {
  it('reads strings and ignores files or missing keys', () => {
    const form = new FormData();
    form.set('name', 'Pixelboard');
    form.set('file', new Blob(['x']));
    expect(formString(form, 'name')).toBe('Pixelboard');
    expect(formString(form, 'file')).toBe('');
    expect(formString(form, 'missing')).toBe('');
  });
  it('parses item JSON and falls back to an empty list', () => {
    expect(parseItemsJson('[{"description":"A"}]')).toEqual([{ description: 'A' }]);
    expect(parseItemsJson('not json')).toEqual([]);
  });
});
