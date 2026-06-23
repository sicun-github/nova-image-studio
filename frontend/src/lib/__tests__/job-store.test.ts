import { describe, expect, it } from 'vitest';
import { getImageSrc } from '@/lib/job-store';

describe('getImageSrc', () => {
  it('returns data URLs unchanged', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';

    expect(getImageSrc(src)).toBe(src);
  });

  it('collapses duplicate data URL prefixes from previously stored jobs', () => {
    expect(getImageSrc('data:image/png;base64,data:image/png;base64,iVBORw0KGgo='))
      .toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('wraps legacy raw base64 image data as a PNG data URL', () => {
    expect(getImageSrc('iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});
