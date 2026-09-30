import { describe, it, expect } from 'vitest';
import { css } from './css.js';

describe('css() style parser', () => {
  it('parses basic declarations', () => {
    expect(css('color:red;display:flex')).toEqual({ color: 'red', display: 'flex' });
  });

  it('converts kebab-case to camelCase', () => {
    const s = css('border-radius:12px;background-color:#fff;font-size:13px;z-index:20');
    expect(s).toEqual({
      borderRadius: '12px',
      backgroundColor: '#fff',
      fontSize: '13px',
      zIndex: '20',
    });
  });

  it('keeps -webkit- prefix as Webkit camel', () => {
    const s = css('-webkit-mask:url(a.svg)');
    expect(s.WebkitMask).toBe('url(a.svg)');
  });

  it('preserves CSS custom properties verbatim', () => {
    const s = css('--brand:#12B8A8;color:var(--brand)');
    expect(s['--brand']).toBe('#12B8A8');
    expect(s.color).toBe('var(--brand)');
  });

  it('strips !important', () => {
    const s = css('box-shadow:none !important;color:red');
    expect(s.boxShadow).toBe('none');
    expect(s.boxShadow).not.toContain('important');
  });

  it('does not split semicolons inside parentheses or quotes', () => {
    const s = css("background:url('data:image/svg+xml;a=b;c=d');font:500 13px 'Geist'");
    expect(s.background).toContain('c=d');
    expect(s.font).toBe("500 13px 'Geist'");
  });

  it('passes objects through unchanged', () => {
    const o = { color: 'red' };
    expect(css(o)).toBe(o);
  });

  it('returns undefined for nullish input', () => {
    expect(css('')).toBeUndefined();
    expect(css(null)).toBeUndefined();
    expect(css(undefined)).toBeUndefined();
  });

  it('skips empty declarations gracefully', () => {
    const s = css('color:red;;display:flex;');
    expect(s).toEqual({ color: 'red', display: 'flex' });
  });

  it('caches parsed results (same string → same object)', () => {
    const a = css('color:red');
    const b = css('color:red');
    expect(a).toBe(b);
  });

  it('whitespace tolerant', () => {
    const s = css('  color :  red ;  display :  flex  ');
    expect(s.color).toBe('red');
    expect(s.display).toBe('flex');
  });
});
