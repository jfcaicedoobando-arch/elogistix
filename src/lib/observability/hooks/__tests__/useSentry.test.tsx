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

  it('sin cliente reporta un estado inactivo acorde al entorno', () => {
    getClientMock.mockReturnValue(undefined as never);
    const { result } = renderHook(() => useSentryInfo());
    // El estado inicial depende del entorno de ejecución:
    //  - MODE=development         -> disabled_dev
    //  - sin VITE_SENTRY_DSN      -> missing_dsn
    //  - con DSN (CI) y SDK aún   -> pending (el SDK carga diferido)
    expect(result.current.active).toBe(false);
    expect(['disabled_dev', 'missing_dsn', 'pending']).toContain(result.current.status);
    if (result.current.status === 'pending') {
      expect(result.current.dsnConfigured).toBe(true);
    }
  });

  it('maskDsn hides sensitive part of DSN', () => {
    expect(maskDsn('https://abcdefghijkl@sentry.io/1')).toContain('abcd…ijkl');
    expect(maskDsn(undefined)).toBe('—');
    expect(maskDsn('invalid')).toBe('(DSN inválido)');
  });
});
