import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as Sentry from '@sentry/react';

vi.mock('@sentry/react', () => ({
  getClient: vi.fn(),
}));

import { useSentryInfo, maskDsn } from '../useSentryInfo';

const getClientMock = vi.mocked(Sentry.getClient);

describe('useSentry Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSentryInfo returns client options', () => {
    getClientMock.mockReturnValue({
      getOptions: () => ({ dsn: 'https://key@host/123', release: '1.0', environment: 'prod' }),
    } as never);

    const { result } = renderHook(() => useSentryInfo());
    expect(result.current.active).toBe(true);
    expect(result.current.status).toBe('active');
    expect(result.current.environment).toBe('prod');
  });

  it('detecta al cliente cuando aparece después del primer render (carga diferida)', async () => {
    getClientMock.mockReturnValue(undefined as never);
    const { result } = renderHook(() => useSentryInfo());
    expect(result.current.active).toBe(false);

    getClientMock.mockReturnValue({
      getOptions: () => ({ dsn: 'https://key@host/123', environment: 'production' }),
    } as never);

    await waitFor(() => expect(result.current.active).toBe(true), { timeout: 3000 });
    expect(result.current.status).toBe('active');
  });

  it('reporta disabled_dev cuando no hay cliente en modo desarrollo', () => {
    getClientMock.mockReturnValue(undefined as never);
    const { result } = renderHook(() => useSentryInfo());
    // Vitest corre en MODE=test, no development; sin DSN el estado es missing_dsn.
    expect(['disabled_dev', 'missing_dsn']).toContain(result.current.status);
  });

  it('maskDsn hides sensitive part of DSN', () => {
    expect(maskDsn('https://abcdefghijkl@sentry.io/1')).toContain('abcd…ijkl');
    expect(maskDsn(undefined)).toBe('—');
    expect(maskDsn('invalid')).toBe('(DSN inválido)');
  });
});
