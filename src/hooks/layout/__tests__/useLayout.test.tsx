import { vi, describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('@/features/auditoria/hooks', () => ({
  useAuditoriaCount: () => ({ data: 5 }),
}));
vi.mock('@/features/admin/hooks', () => ({
  useAlertasPendingCount: () => ({ count: 2 }),
}));
vi.mock('@/features/crm/hooks/useCrmDashboard', () => ({
  useActividadesVencidasCount: () => ({ data: 0 }),
}));
vi.mock('../useSidebarAlerts', () => ({
  useSidebarAlerts: () => ({
    totalAlertas: 0,
    embarquesDemora: 0,
    facturasVencidas: 0,
    garantiasAtoradas: 0,
    adminPendientes: 0,
  }),
}));
vi.mock('@/features/cxp/hooks/useCxpPendientesAprobacion', () => ({
  useCxpPendientesAprobacion: () => ({ data: 0 }),
}));
vi.mock('@/features/cxp/hooks/useCxpPorPagarCount', () => ({
  useCxpPorPagarCount: () => ({ data: 0 }),
}));

import { useAuth } from '@/lib/contexts/AuthContext';
import { useAppSidebarSections } from '../useAppSidebarSections';

describe('useLayout Hooks', () => {
  it('returns full sections for super_admin', () => {
    (useAuth as any).mockReturnValue({ role: 'super_admin', effectiveRole: 'super_admin' });
    const { result } = renderHook(() => useAppSidebarSections());
    
    const labels = result.current.map(s => s.label);
    expect(labels).toContain('Super Admin');
    expect(labels).toContain('Administración');
  });

  it('returns administración section for admin_org', () => {
    (useAuth as any).mockReturnValue({ role: 'admin', effectiveRole: 'admin_org' });
    const { result } = renderHook(() => useAppSidebarSections());

    const labels = result.current.map(s => s.label);
    expect(labels).toContain('Administración');
    expect(result.current.some(section => section.items.some(item => item.url === '/usuarios'))).toBe(true);
  });

  it('returns restricted sections for vendedor', () => {
    (useAuth as any).mockReturnValue({ role: 'vendedor', effectiveRole: 'vendedor' });
    const { result } = renderHook(() => useAppSidebarSections());

    const labels = result.current.map(s => s.label);
    // v13.318.0 — Sidebar Etapa 2: CRM se integra en "Operación";
    // Clientes vive dentro de "Ventas (CxC)".
    expect(labels).toContain('Operación');
    expect(labels).toContain('Ventas (CxC)');
    expect(labels).toContain('Sistema');
    expect(labels).not.toContain('Administración');
    expect(labels).not.toContain('Super Admin');
    // El item CRM sigue existiendo, ahora dentro de Operación.
    const operacion = result.current.find(s => s.label === 'Operación');
    expect(operacion?.items.some(it => it.url === '/crm')).toBe(true);
    // Clientes se movió de Directorio a Ventas.
    const ventas = result.current.find(s => s.label === 'Ventas (CxC)');
    expect(ventas?.items.some(it => it.url === '/clientes')).toBe(true);
  });
});
