import { describe, expect, it } from 'vitest';
import { keyboardInset } from '../src/hooks/useKeyboardInset';

describe('keyboardInset', () => {
  it('is 0 when the whole page is visible', () => {
    expect(keyboardInset(812, 812, 0)).toBe(0);
  });

  it('is the covered part at the bottom when a keyboard opens', () => {
    expect(keyboardInset(812, 476, 0)).toBe(336);
  });

  it('takes into account that the page scrolled up to show the field', () => {
    // אייפון: הדף נגלל 120 פיקסלים, והחלק הנראה מתחיל שם
    expect(keyboardInset(812, 476, 120)).toBe(216);
  });

  it('ignores small changes, like the address bar showing and hiding', () => {
    expect(keyboardInset(812, 756, 0)).toBe(0);
  });

  it('is 0 when the browser already shrinks the page for the keyboard', () => {
    // אנדרואיד עם interactive-widget=resizes-content: גם הדף וגם החלק הנראה קטנים יחד
    expect(keyboardInset(476, 476, 0)).toBe(0);
  });
});
