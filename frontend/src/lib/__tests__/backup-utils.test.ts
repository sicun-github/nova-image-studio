import { describe, expect, it, vi } from 'vitest';
import { generateBackupFilename } from '@/lib/backup-utils';

describe('backup utils', () => {
  it('uses the Zyt backup filename prefix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T13:01:05'));

    expect(generateBackupFilename()).toBe('zyt-backup-2026-06-22-13-01-05.zip');

    vi.useRealTimers();
  });
});
