import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ rpc:vi.fn(), from:vi.fn(), save:vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase:{rpc:mocks.rpc,from:mocks.from} }));
vi.mock('@/features/configuracion/services', async () => ({
 fetchConfiguracion:vi.fn(), fetchEmisorEmpresa:(await import('@/features/configuracion/services/emisor')).fetchEmisorEmpresa,
 updateConfiguracionByCategoriaClave:mocks.save,
}));
vi.mock('@/hooks/shared/useOrgActiva', () => ({ useOrgActiva:() => ({organizationId:'synthetic-a'}) }));
vi.mock('@/lib/ui/appFeedback', () => ({notifySuccess:vi.fn(),notifyError:vi.fn()}));
import { useUpdateConfiguracion } from '@/features/configuracion/hooks/useConfiguracion';
import { useEmisorEmpresa } from '@/features/facturacion/hooks/useEmisorEmpresa';
import { invalidarEmisorCache } from '@/features/configuracion/services/emisor';
import { setAuthSnapshot } from '@/lib/auth/authSnapshot';
import { syncActiveOrganizationScope } from '@/lib/auth/authOperationScope';

describe('Emisor: invalidación de lectura inicial compartida por React Query', () => {
 it('recarga antes de resolver la lectura previa al guardado y conserva sólo el nombre vigente', async () => {
  setAuthSnapshot({userId:'synthetic-user',email:null,organizationId:null,organizationName:null,role:'super_admin',effectiveRole:'super_admin'});
  syncActiveOrganizationScope({userId:'synthetic-user',organizationId:'synthetic-a'});
  invalidarEmisorCache();
  mocks.rpc.mockResolvedValue({data:'synthetic-a',error:null});
  let finish!: (result: unknown) => void;
  const pending = new Promise((resolve) => { finish = resolve; });
  mocks.from.mockReturnValue({select:() => ({eq:() => ({eq:() => pending})})});
  mocks.save.mockImplementation(async () => { invalidarEmisorCache(); });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  function Wrapper({children}:{children:ReactNode}) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const {result,unmount}=renderHook(() => ({emisor:useEmisorEmpresa(),save:useUpdateConfiguracion()}),{wrapper:Wrapper});
  await waitFor(() => expect(mocks.from).toHaveBeenCalledOnce());
  await act(async () => { await result.current.save.mutateAsync([{categoria:'empresa',clave:'nombre',valor:'Saved new name'}]); });
  mocks.from.mockReturnValue({select:() => ({eq:() => ({eq:() => Promise.resolve({data:[{clave:'nombre',valor:'Saved new name'}],error:null})})})});
  act(() => finish({data:[{clave:'nombre',valor:'Old pre-save name'}],error:null}));
  await waitFor(() => expect(result.current.emisor.data?.razonSocial).toBe('Saved new name'));
  expect(result.current.emisor.isStale).toBe(false);
  expect(mocks.from).toHaveBeenCalledTimes(2);
  unmount(); client.clear();
 });
});
