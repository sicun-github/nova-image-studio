import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const agentClientSource = fs.readFileSync(
  path.resolve(testDir, '../agent-chat-client.ts'),
  'utf8',
);
const serverSource = fs.readFileSync(
  path.resolve(testDir, '../../../../backend/server.js'),
  'utf8',
);

describe('Agent Responses proxy', () => {
  it('routes Agent text requests through the same-origin backend proxy', () => {
    expect(agentClientSource).toContain("fetch('/api/nova/responses'");
    expect(agentClientSource).not.toContain('buildResponsesApiUrl');
  });

  it('exposes a backend Responses API proxy route', () => {
    expect(serverSource).toContain("apiPathname === '/api/nova/responses'");
    expect(serverSource).toContain("`${baseUrl}/v1/responses`");
  });
});
