import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const reverseClientSource = fs.readFileSync(
  path.resolve(testDir, '../reverse-prompt-client.ts'),
  'utf8',
);

describe('Reverse prompt Responses proxy', () => {
  it('routes OpenAI reverse prompt requests through the same-origin backend proxy', () => {
    expect(reverseClientSource).toContain("fetch('/api/nova/responses'");
    expect(reverseClientSource).not.toContain('buildResponsesApiUrl');
    expect(reverseClientSource).not.toContain('Authorization: `Bearer ${input.apiKey}`');
  });
});
