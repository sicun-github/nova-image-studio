import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));

function readLibSource(fileName: string): string {
  return fs.readFileSync(path.resolve(testDir, `../${fileName}`), 'utf8');
}

const serverSource = fs.readFileSync(
  path.resolve(testDir, '../../../../backend/server.js'),
  'utf8',
);
const promptOptimizeSource = readLibSource('prompt-optimize-client.ts');
const assetMetadataSource = readLibSource('asset-metadata-client.ts');
const reversePromptSource = readLibSource('reverse-prompt-client.ts');
const taskClientSource = readLibSource('ccode-task-client.ts');
const modelEndpointsSource = readLibSource('model-endpoints.ts');

describe('model API same-origin proxy', () => {
  it('routes prompt optimization and asset metadata through the Responses proxy', () => {
    expect(promptOptimizeSource).toContain("fetch('/api/nova/responses'");
    expect(promptOptimizeSource).not.toContain('fetch(`${baseUrl}/v1/responses`');
    expect(promptOptimizeSource).not.toContain('Authorization: `Bearer ${input.apiKey}`');

    expect(assetMetadataSource).toContain("fetch('/api/nova/responses'");
    expect(assetMetadataSource).not.toContain('fetch(`${baseUrl}/v1/responses`');
    expect(assetMetadataSource).not.toContain('Authorization: `Bearer ${input.apiKey}`');
  });

  it('routes Gemini reverse prompt streams through the backend proxy', () => {
    expect(reversePromptSource).toContain("fetch('/api/nova/gemini-stream'");
    expect(reversePromptSource).not.toContain('buildGeminiStreamGenerateContentUrl');
    expect(reversePromptSource).not.toContain('x-goog-api-key');
  });

  it('routes model availability checks through the backend proxy', () => {
    expect(taskClientSource).toContain("fetchWithTimeout('/api/nova/models/check'");
    expect(taskClientSource).not.toContain('/v1beta/models');
    expect(taskClientSource).not.toContain('/v1/models');
    expect(taskClientSource).not.toContain('buildResponsesApiUrl');
  });

  it('keeps external model API URLs only in the backend proxy layer', () => {
    expect(modelEndpointsSource).not.toContain('/v1/responses');
    expect(modelEndpointsSource).not.toContain('streamGenerateContent');
    expect(serverSource).toContain("apiPathname === '/api/nova/responses'");
    expect(serverSource).toContain("apiPathname === '/api/nova/gemini-stream'");
    expect(serverSource).toContain("apiPathname === '/api/nova/models/check'");
  });
});
