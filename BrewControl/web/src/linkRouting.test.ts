import { describe, expect, it } from 'vitest';
import { routableHref } from './linkRouting';

describe('routableHref', () => {
  it('routes in-app paths', () => {
    expect(routableHref('/', null, false)).toBe('/');
    expect(routableHref('/settings/x?y=1', null, false)).toBe('/settings/x?y=1');
    expect(routableHref('/logs/a/archive', '_self', false)).toBe('/logs/a/archive');
  });
  it('leaves everything else to the browser', () => {
    expect(routableHref(null, null, false)).toBeNull();
    expect(routableHref('', null, false)).toBeNull();
    expect(routableHref('//evil.example', null, false)).toBeNull();
    expect(routableHref('https://www.bjcp.org', null, false)).toBeNull();
    expect(routableHref('mailto:a@b.c', null, false)).toBeNull();
    expect(routableHref('/api/logs/a/download', null, false)).toBeNull();
    expect(routableHref('/settings', '_blank', false)).toBeNull();
    expect(routableHref('/settings', null, true)).toBeNull();
  });
});
