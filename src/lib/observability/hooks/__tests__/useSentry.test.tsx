import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as Sentry from '@sentry/react';

vi.mock('@sentry/react', () => ({
  getClient: vi.fn(),
}));

import { useSentryInfo, maskDsn } from '../useSentryInfo';

describe('useSentry Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSentryInfo returns client options', () => {
    const mockClient = {
      getOptions: () => ({ dsn: 'https://key@host/123', release: '1.0', environment: 'prod' }),
    };
    (Sentry.getClient as any).mockReturnValue(mockClient);

    const { result } = renderHook(() => useSentryInfo());
    expect(result.current.active).toBe(true);
    expect(result.current.environment).toBe('prod');
  });

  it('maskDsn hides sensitive part of DSN', () => {
    expect(maskDsn('https://abcdefghijkl@sentry.io/1')).toContain('abcd…ijkl');
    expect(maskDsn(undefined)).toBe('—');
    expect(maskDsn('invalid')).toBe('(DSN inválido)');
  });
});
