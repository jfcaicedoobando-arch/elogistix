// Real auth lifecycle and plan hook; only external I/O is mocked.
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { isCancelledError, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  subscribe: vi.fn(), getSession: vi.fn(), profile: vi.fn(), planes: vi.fn(),
  signOut: vi.fn(), persistedClear: vi.fn(),
}));
vi.mock('@/features/auth/services', () => ({
  subscribeToAuthChanges: io.subscribe, getCurrentSession: io.getSession, fetchUserContext: io.profile,
}));
vi.mock('@/features/admin/services/planes', () => ({fetchPlanes: io.planes, updatePlan: vi.fn()}));
vi.mock('@/lib/query', async () => ({queryKeys: {
  planes: (await import('@/features/admin/queryKeys')).planes,
  auth: (await import('@/features/auth/queryKeys')).auth,
}}));
vi.mock('@/lib/contexts/auth/useLoginAudit', () => ({useLoginAudit: () => ({clearLoginAudit: vi.fn()})}));
vi.mock('@/lib/observability/sentry/user', () => ({syncSentryUser: vi.fn()}));
vi.mock('@/lib/diagnostics/errorDetailsStore', () => ({clearErrorReports: vi.fn()}));
vi.mock('@/lib/ui/appFeedback', () => ({notifyWarning: vi.fn(), notifySuccess: vi.fn(), notifyError: vi.fn()}));
vi.mock('@/lib/errors', () => ({getErrorMessage: (error: Error) => error.message}));
vi.mock('@/services/bitacora', () => ({registrarActividad: vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/lib/auth/signOut', () => ({signOutCurrentSession: io.signOut}));
vi.mock('@/lib/browserStorage', () => ({clearPersistedQueryCache: io.persistedClear}));
vi.mock('@/features/cotizacion/hooks/wizard/cotizacionDraftStorage', () => ({clearAllDrafts: vi.fn()}));
vi.mock('@/features/embarques/hooks/wizard/embarqueDraftStorage', () => ({clearAllEmbarqueDrafts: vi.fn()}));
vi.mock('@/integrations/supabase/client', () => ({supabase: new Proxy({}, {
  get: () => {throw new Error('Remote I/O is forbidden in this local audit');},
})}));

import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext';
import { usePlanes } from '@/features/admin/hooks/usePlanes';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { getAuthSnapshot, setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { purgeSessionCache } from '@/lib/auth/purgeSessionCache';

const activePlan = {id:'active',nombre:'Activo',activo:true};
const inactivePlan = {id:'inactive',nombre:'Inactivo reservado',activo:false};
let role: 'super_admin' | 'operador';
let trigger: (event: AuthChangeEvent, session: Session | null) => void;
let client: QueryClient;
const session = (id: string) => ({user:{id,email:`${id}@example.invalid`},access_token:`mock-${id}`} as Session);
const profile = () => ({role,orgRole:role === 'super_admin' ? null : role,
  organizationId:'org',organization:{id:'org',nombre:'Organización ficticia',onboarding_completado:true}});

function Wrapper({children}:{children:ReactNode}) {
  return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
const useProbe = () => ({auth:useAuth(),planes:usePlanes()});
const cachedPlans = () => client.getQueriesData<typeof activePlan[]>({queryKey:['planes']})
  .flatMap(([,data]) => data ?? []);
async function readyProbe() {
  const hook = renderHook(useProbe,{wrapper:Wrapper});
  await waitFor(() => expect(hook.result.current.auth.effectiveRole).toBe('super_admin'));
  await waitFor(() => expect(hook.result.current.planes.data).toContainEqual(inactivePlan));
  return hook;
}

beforeEach(() => {
  role = 'super_admin';
  client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity},mutations:{retry:false}}});
  setAuthSnapshot({userId:null,email:null,role:null,effectiveRole:null,organizationId:null,organizationName:null});
  io.subscribe.mockImplementation(callback => {trigger=callback; return {unsubscribe:vi.fn()};});
  io.getSession.mockResolvedValue(session('admin'));
  io.profile.mockImplementation(async () => profile());
  io.planes.mockImplementation(async () => role === 'super_admin' ? [activePlan,inactivePlan] : [activePlan]);
  io.signOut.mockImplementation(async () => trigger('SIGNED_OUT',null));
  // Prevent idle route preloads and any unrelated service imports.
  Object.defineProperty(window,'requestIdleCallback',{configurable:true,value:vi.fn(() => 1)});
  Object.defineProperty(window,'cancelIdleCallback',{configurable:true,value:vi.fn()});
});
afterEach(() => {cleanup();client.clear();});

describe('Local audit: plan cache and actual auth lifecycle', () => {
  it('records whether direct SIGNED_IN of another user purges the cached plan query', async () => {
    const {result}=await readyProbe();
    role='operador';
    await act(async () => trigger('SIGNED_IN',session('regular')));
    await waitFor(() => expect(result.current.auth.user?.id).toBe('regular'));
    await waitFor(() => expect(cachedPlans()).not.toContainEqual(inactivePlan));
  });

  it('same-user demotion removes inactive plans from both cache and mounted hook', async () => {
    const {result}=await readyProbe();
    const calls=io.planes.mock.calls.length;
    role='operador';
    await act(async () => result.current.auth.refreshProfile());
    await waitFor(() => expect(result.current.auth.effectiveRole).toBe('operador'));
    expect(getAuthSnapshot().effectiveRole).toBe('operador');
    await waitFor(() => expect(result.current.planes.data).toEqual([activePlan]));
    expect(cachedPlans()).not.toContainEqual(inactivePlan);
    expect(io.planes.mock.calls.length).toBeGreaterThan(calls);
  });

  it('external SIGNED_OUT clears plans before another user signs in', async () => {
    const {result}=await readyProbe();
    await act(async () => trigger('SIGNED_OUT',null));
    expect(result.current.auth.user).toBeNull();
    await waitFor(() => expect(cachedPlans()).toEqual([]));
    expect(result.current.planes.data).toBeUndefined();
    role='operador';
    await act(async () => trigger('SIGNED_IN',session('regular')));
    await waitFor(() => expect(result.current.auth.effectiveRole).toBe('operador'));
    await waitFor(() => expect(result.current.planes.data).toEqual([activePlan]));
    expect(cachedPlans()).not.toContainEqual(inactivePlan);
  });

  it('explicit signOut removes the plan cache and persisted cache', async () => {
    const {result}=renderHook(useAuth,{wrapper:Wrapper});
    await waitFor(() => expect(result.current.effectiveRole).toBe('super_admin'));
    client.setQueryData(['planes'],[activePlan,inactivePlan]);
    await act(async () => result.current.signOut());
    expect(client.getQueryData(['planes'])).toBeUndefined();
    expect(io.persistedClear).toHaveBeenCalledOnce();
  });

  it('late response cannot reinsert plans after the actual queryClient.clear purge', async () => {
    let resolve!: (data:typeof activePlan[]) => void;
    const pending=client.fetchQuery({queryKey:['planes'],queryFn:() => new Promise(r => {resolve=r;})})
      .catch(error => error);
    await act(async () => purgeSessionCache(client));
    await act(async () => resolve([activePlan,inactivePlan]));
    expect(isCancelledError(await pending)).toBe(true);
    expect(client.getQueryData(['planes'])).toBeUndefined();
  });

  it('late admin response cannot fill the catalog cache after a role demotion', async () => {
    let resolve!: (data:typeof activePlan[]) => void;
    io.planes.mockImplementationOnce(() => new Promise(r => {resolve=r;}));
    const {result}=renderHook(useProbe,{wrapper:Wrapper});
    await waitFor(() => expect(result.current.auth.effectiveRole).toBe('super_admin'));
    role='operador';
    await act(async () => result.current.auth.refreshProfile());
    await waitFor(() => expect(result.current.auth.effectiveRole).toBe('operador'));
    await act(async () => resolve([activePlan,inactivePlan]));
    await waitFor(() => expect(result.current.planes.data).toEqual([activePlan]));
    expect(cachedPlans()).not.toContainEqual(inactivePlan);
  });

  it('actual super_admin route guard removes the plan consumer when the role is downgraded', async () => {
    function AuthProbe(){const {refreshProfile}=useAuth();return <button onClick={() => void refreshProfile()}>Refrescar perfil</button>;}
    function PlanConsumer(){const plans=usePlanes();return <div>{plans.data?.map(p => <span key={p.id}>{p.nombre}</span>)}</div>;}
    render(<Wrapper><AuthProbe/><MemoryRouter initialEntries={['/admin/configuracion']}><Routes>
      <Route path='/admin/configuracion' element={<ProtectedRoute allowedRoles={['super_admin']}><PlanConsumer/></ProtectedRoute>}/>
      <Route path='/sin-acceso' element={<div>Acceso denegado</div>}/>
    </Routes></MemoryRouter></Wrapper>);
    await screen.findByText(inactivePlan.nombre);
    role='operador';
    await act(async () => {fireEvent.click(screen.getByRole('button',{name:'Refrescar perfil'}));});
    await screen.findByText('Acceso denegado');
    expect(screen.queryByText(inactivePlan.nombre)).toBeNull();
    await waitFor(() => expect(cachedPlans()).not.toContainEqual(inactivePlan));
  });
  it('external logout removes all five catalogs without mounted catalog consumers', async () => {
    const {result}=renderHook(useAuth,{wrapper:Wrapper});
    await waitFor(() => expect(result.current.effectiveRole).toBe('super_admin'));
    const roots=['planes','puertos','navieras','tipos_contenedor','tipos_cambio_dof'];
    for(const root of roots) client.setQueryData([root],[inactivePlan]);
    client.setQueryData(['unrelated-audit-domain'],'keep');
    await act(async () => trigger('SIGNED_OUT',null));
    await waitFor(() => {
      for(const root of roots) expect(client.getQueryData([root])).toBeUndefined();
    });
    expect(client.getQueryData(['unrelated-audit-domain'])).toBe('keep');
  });
});
