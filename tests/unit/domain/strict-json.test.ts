import { describe, expect, it } from 'vitest';
import { parseStrictJson } from '../../../src/domain/definitions/strict-json';

const document = 'fixture.json';

describe('strict JSON parsing', () => {
  it('allows the same property in separate nested objects and array elements', () => {
    const value = {
      id: 'outer',
      children: [{ id: 'first' }, { id: 'second', nested: { id: 'inner' } }],
    };

    expect(parseStrictJson(JSON.stringify(value), document)).toEqual({ success: true, value });
  });

  it('treats key-like text and structural punctuation inside strings as data', () => {
    const value = { label: '["id": "value", {"id": "other"}]', id: 'actual' };

    expect(parseStrictJson(JSON.stringify(value), document)).toEqual({ success: true, value });
  });

  it.each([
    ['the same object', '{"id":1,"id":2}', 'id'],
    ['a nested object in an array', '{"items":[{"id":1,"id":2}]}', 'id'],
    ['an escaped spelling of the same name', '{"id":1,"\\u0069d":2}', 'id'],
    ['an empty property name', '{"":1,"":2}', ''],
  ])('reports a repeated property in %s', (_, json, duplicateKey) => {
    expect(parseStrictJson(json, document)).toMatchObject({
      success: false,
      diagnostics: [
        {
          document,
          pointer: '',
          code: 'INVALID_JSON',
          message: expect.stringContaining(
            'The property ' + JSON.stringify(duplicateKey) + ' appears more than once',
          ),
        },
      ],
    });
  });

  it('reports invalid JSON syntax before scanning property names', () => {
    expect(parseStrictJson('{"id":1,"id":2,}', document)).toMatchObject({
      success: false,
      diagnostics: [
        {
          document,
          pointer: '',
          code: 'INVALID_JSON',
          message: 'Provide a valid UTF-8 JSON definition.',
        },
      ],
    });
  });

  it('returns a valid JSON value for downstream shape validation', () => {
    expect(parseStrictJson('null', document)).toEqual({ success: true, value: null });
  });
});
