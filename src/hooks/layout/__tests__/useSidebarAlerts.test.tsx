/**
 * Cobertura del punto 3 de la auditoría Cloud: los badges del sidebar deben
 * servirse de caché (sin refetch al montar) y sólo recalcularse cuando se
 * invalidan explícitamente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const fetchSidebarAlertCounts = vi.fn();
const fetchAdminPendientesCount = vi.fn();

vi.mock('@/features/reportes/services', () => ({
  fetchSidebarAlertCounts: () => fetchSidebarAlertCounts(),
}));
vi.mock('@/features/embarques/services/cierre', () => ({
  fetchAdminPendientesCount: () => fetchAdminPendientesCount(),
}));

// Sentry JAVASCRIPT-REACT-5X: sin sesión los contadores no deben consultarse.
let usuarioActual: { id: string } | null = { id: 'u-1' };
let sesionActual: { access_token: string } | null = { access_token: 'tok' };
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: usuarioActual, session: sesionActual }),
}));

import { useSidebarAlerts, invalidateSidebarAlerts } from '../useSidebarAlerts';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useSidebarAlerts', () => {
  beforeEach(() => {
    fetchSidebarAlertCounts.mockResolvedValue({
      embarquesDemora: 2,
      facturasVencidas: 3,
      garantiasAtoradas: 1,
    });
    fetchAdminPendientesCount.mockResolvedValue(4);
    usuarioActual = { id: 'u-1' };
    sesionActual = { access_token: 'tok' };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('suma los cuatro contadores en totalAlertas', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSidebarAlerts(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.totalAlertas).toBe(10));
    expect(result.current.embarquesDemora).toBe(2);
    expect(result.current.adminPendientes).toBe(4);
    client.clear();
  });

  it('no vuelve a consultar al remontar: el dato en caché se reutiliza', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const first = renderHook(() => useSidebarAlerts(), { wrapper });
    await waitFor(() => expect(first.result.current.totalAlertas).toBe(10));
    expect(fetchSidebarAlertCounts).toHaveBeenCalledTimes(1);

    first.unmount();
    const second = renderHook(() => useSidebarAlerts(), { wrapper });
    await waitFor(() => expect(second.result.current.totalAlertas).toBe(10));

    // refetchOnMount: false => sigue en 1 llamada, no 2.
    expect(fetchSidebarAlertCounts).toHaveBeenCalledTimes(1);
    expect(fetchAdminPendientesCount).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('invalidateSidebarAlerts fuerza un recálculo de ambos contadores', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const { result } = renderHook(() => useSidebarAlerts(), { wrapper });
    await waitFor(() => expect(result.current.totalAlertas).toBe(10));
    expect(fetchSidebarAlertCounts).toHaveBeenCalledTimes(1);

    fetchSidebarAlertCounts.mockResolvedValue({
      embarquesDemora: 0,
      facturasVencidas: 0,
      garantiasAtoradas: 0,
    });
    fetchAdminPendientesCount.mockResolvedValue(0);

    invalidateSidebarAlerts(client);

    await waitFor(() => expect(result.current.totalAlertas).toBe(0));
    expect(fetchSidebarAlertCounts).toHaveBeenCalledTimes(2);
    expect(fetchAdminPendientesCount).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('sin sesión (p.ej. /login) no consulta las RPC: evita permission denied', async () => {
    usuarioActual = null;
    const client = makeClient();
    const { result } = renderHook(() => useSidebarAlerts(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.totalAlertas).toBe(0));
    expect(fetchSidebarAlertCounts).not.toHaveBeenCalled();
    expect(fetchAdminPendientesCount).not.toHaveBeenCalled();
    client.clear();
  });

  it('con usuario en memoria pero token expirado tampoco consulta (Sentry -5X)', async () => {
    sesionActual = null;
    const client = makeClient();
    const { result } = renderHook(() => useSidebarAlerts(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.totalAlertas).toBe(0));
    expect(fetchSidebarAlertCounts).not.toHaveBeenCalled();
    expect(fetchAdminPendientesCount).not.toHaveBeenCalled();
    client.clear();
  });
});
