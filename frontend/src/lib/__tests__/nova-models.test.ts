import { describe, expect, it } from 'vitest';
import { BUILTIN_IMAGE_PRESETS, BUILTIN_IMAGE_PRESET_OPTIONS, IMAGE_MODEL_BASE_URL } from '@/lib/nova-models';

describe('image model presets', () => {
  it('includes GPT Image 2 Fast, Plus, and Pro presets on the built-in gateway', () => {
    const ids = BUILTIN_IMAGE_PRESET_OPTIONS.map((option) => option.value);
    expect(ids).toEqual(expect.arrayContaining([
      'gpt-image-2-fast',
      'gpt-image-2-plus',
      'gpt-image-2-pro',
    ]));

    expect(BUILTIN_IMAGE_PRESETS['gpt-image-2-fast']).toMatchObject({
      name: 'GPT Image 2 Fast',
      modelId: 'gpt-image-2-fast',
      baseUrl: IMAGE_MODEL_BASE_URL,
      supportsAdvancedParams: true,
    });
    expect(BUILTIN_IMAGE_PRESETS['gpt-image-2-plus']).toMatchObject({
      name: 'GPT Image 2 Plus',
      modelId: 'gpt-image-2-plus',
      baseUrl: IMAGE_MODEL_BASE_URL,
      supportsAdvancedParams: true,
    });
    expect(BUILTIN_IMAGE_PRESETS['gpt-image-2-pro']).toMatchObject({
      name: 'GPT Image 2 Pro',
      modelId: 'gpt-image-2-pro',
      baseUrl: IMAGE_MODEL_BASE_URL,
      supportsAdvancedParams: true,
    });
  });
});
