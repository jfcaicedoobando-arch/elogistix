// Real screens and DataTable; hook I/O and unrelated dialogs mocked.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: {} as {data?:unknown[];isLoading:boolean;isError:boolean;error?:unknown;refetch:ReturnType<typeof vi.fn>;isFetching:boolean},
  superAdmin:true,
}));
const mutation = vi.hoisted(() => ({mutate:vi.fn(),isPending:false}));
vi.mock('@/hooks/shared', () => ({usePermissions:() => ({isSuperAdmin:state.superAdmin})}));
vi.mock('@/features/catalogos/hooks', () => ({
  useAllNavieras:() => state.query,useAllPuertos:() => state.query,useAllTiposContenedor:() => state.query,
  useAdminNavieras:() => ({agregarNaviera:mutation,toggleActivo:mutation,eliminarNaviera:mutation}),
  useAdminPuertos:() => ({agregarPuerto:mutation,toggleActivo:mutation,eliminarPuerto:mutation}),
  useAdminTiposContenedor:() => ({agregarTipo:mutation,toggleActivo:mutation,eliminarTipo:mutation}),
}));
vi.mock('@/features/catalogos/hooks/useTipoCambioDof', () => ({
  useHistorialTcDof:() => state.query,useUpsertTcDofManual:() => mutation,
}));
vi.mock('@/features/admin/hooks', () => ({usePlanes:() => state.query,useUpdatePlan:() => mutation}));
vi.mock('@/components/shared/NavieraFormDialog', () => ({NavieraFormDialog:() => null}));
vi.mock('@/components/shared/DoubleConfirmDeleteDialog', () => ({default:() => null}));
vi.mock('@/components/shared/FormField', () => ({FormField:({label,children}:{label:string;children:ReactNode}) => <label>{label}{children}</label>}));
vi.mock('@/components/ui/date-picker-mx', () => ({DatePickerMx:() => <input aria-label='Fecha'/>}));
vi.mock('@/lib/ui/appFeedback', () => ({notifyError:vi.fn()}));
vi.mock('@/integrations/supabase/client', () => ({supabase:new Proxy({}, {
  get:() => {throw new Error('Remote I/O is forbidden in this local audit');},
})}));

import TabNavieras from '@/features/configuracion/components/TabNavieras';
import TabPuertos from '@/features/configuracion/components/TabPuertos';
import TabTiposContenedor from '@/features/configuracion/components/TabTiposContenedor';
import TabTipoCambioDof from '@/features/configuracion/components/TabTipoCambioDof';
import TabPlanes from '@/features/admin/components/TabPlanes';

const screens = [
  {name:'navieras',Component:TabNavieras,empty:'No se encontraron navieras'},
  {name:'puertos',Component:TabPuertos,empty:'No se encontraron puertos'},
  {name:'contenedores',Component:TabTiposContenedor,empty:'No se encontraron tipos de contenedor'},
  {name:'DOF',Component:TabTipoCambioDof,empty:'Aún no hay publicaciones registradas'},
  {name:'planes',Component:TabPlanes,empty:'No hay planes configurados'},
];
beforeEach(() => {
  state.superAdmin=true;
  state.query={data:[],isLoading:false,isError:false,refetch:vi.fn(),isFetching:false};
});
afterEach(cleanup);

describe.each(screens)('Local screen audit: $name', ({Component,empty}) => {
  it('initial load shows the DataTable loading state, not an empty catalog', () => {
    state.query={...state.query,data:undefined,isLoading:true,isFetching:true};
    render(<Component/>);
    expect(screen.getByText('Cargando…')).toBeDefined();
    expect(screen.queryByText(empty)).toBeNull();
  });
  it('network error has an explicit alert and retry instead of an empty catalog', () => {
    state.query={...state.query,data:undefined,isError:true,error:new Error('Mock network failure')};
    render(<Component/>);
    expect(screen.queryByText(empty)).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar el catálogo');
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(state.query.refetch).toHaveBeenCalledOnce();
  });
  it('SELECT permission denial is distinct from a technical error and empty catalog', () => {
    state.query={...state.query,data:undefined,isError:true,error:{code:'42501',message:'permission denied for table'}};
    render(<Component/>);
    expect(screen.queryByText(empty)).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('No tienes acceso a este catálogo');
    expect(screen.queryByText(/revisa tu conexión/i)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(state.query.refetch).toHaveBeenCalledOnce();
  });
  it('a successful empty result still renders the empty catalog', () => {
    render(<Component/>);
    expect(screen.getByText(empty)).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

it('common users do not receive platform catalog creation or manual DOF controls', () => {
  state.superAdmin=false;
  for(const {Component} of screens.slice(0,4)){
    const view=render(<Component/>);
    expect(screen.queryByRole('button',{name:/^agregar$|guardar captura manual/i})).toBeNull();
    view.unmount();
  }
});
