import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(
  path.resolve(testDir, '../../../../backend/server.js'),
  'utf8',
);

describe('backend GPT Image advanced params forwarding', () => {
  it('does not contain legacy GPT Image SKU gating or token suffix logic', () => {
    expect(serverSource).not.toMatch(/if\s*\([^)]*gpt-image-2-(?:fast|plus|pro)/);
    expect(serverSource).not.toMatch(/case\s+['"]gpt-image-2-(?:fast|plus|pro)['"]/);
    expect(serverSource).not.toContain('TOKEN_SUFFIX');
    expect(serverSource).not.toContain('supportsGptImageAdvancedParams(');
  });

  it('forwards quality/background/output_format and conditional style in multipart image edits', () => {
    expect(serverSource).not.toContain("formData.append('response_format', 'url')");
    expect(serverSource).toContain("fields.push(['quality', advancedParams.quality])");
    expect(serverSource).toContain("fields.push(['background', advancedParams.background])");
    expect(serverSource).toContain("fields.push(['output_format', 'png'])");
    expect(serverSource).toContain("fields.push(['style', advancedParams.style])");
  });

  it('forwards quality/background/output_format and conditional style in JSON generations', () => {
    expect(serverSource).not.toContain("response_format: 'url'");
    expect(serverSource).toContain('quality: advancedParams.quality');
    expect(serverSource).toContain('background: advancedParams.background');
    expect(serverSource).toContain("output_format: 'png'");
    expect(serverSource).toContain("advancedParams.style === 'vivid' || advancedParams.style === 'natural' ? { style: advancedParams.style } : {}");
  });

  it('routes OpenAI image endpoint by mode rather than legacy model names', () => {
    expect(serverSource).toContain("request.mode === 'image-to-image'");
    expect(serverSource).toContain("/v1/images/edits");
    expect(serverSource).toContain("/v1/images/generations");
  });

  it('forwards model in multipart image edits', () => {
    expect(serverSource).toContain("const requestUrl = `${baseUrl}${endpoint}`");
    expect(serverSource).toContain("['model', request.model]");
    expect(serverSource).toContain("'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`");
    expect(serverSource).toContain('contentLength: multipart.body.length');
    expect(serverSource).toContain('if (dispatcher)');
    expect(serverSource).toContain("'Content-Length': String(requestInit.contentLength)");
  });

  it('resolves and forwards GPT Image size from layout params', () => {
    expect(serverSource).toContain('function resolveGptImageSize(request)');
    expect(serverSource).toContain('normalizeCustomImageSize(request.customSize, GPT_IMAGE_MAX_SIDE)');
    expect(serverSource).toContain('getSupportedGptImageSize(request.model, request.outputSize, request.aspectRatio)');
    expect(serverSource).toContain('const resolvedSize = resolveGptImageSize(request)');
    expect(serverSource).toContain('return requestGptImage(apiKey, request, resolvedSize, { baseUrl, ...context })');
  });

  it('stores base64 images on the backend and returns backend image URLs', () => {
    const match = serverSource.match(/async function generateSingleImage[\s\S]*?\n}\n\nasync function runTask/);
    expect(match?.[0]).toContain('imageRefs.push(`URL:${remoteUrl}`)');
    expect(match?.[0]).toContain('const saved = saveImageToDisk(taskId, index, subIdx, img)');
    expect(match?.[0]).toContain('imageRefs.push(`URL:${saved.url}`)');
    expect(serverSource).not.toContain('downloadUrlToDisk(');
    expect(serverSource).toContain('function saveImageToDisk(taskId, itemIndex, subIndex, imagePayload)');
  });
});
