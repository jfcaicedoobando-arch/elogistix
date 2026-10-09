import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import type { CotizacionFormValues } from '@/features/cotizacion/types';
import { COTIZACION_FORM_DEFAULTS } from '@/features/cotizacion/types/formDefaults';
import { dedupeTiposContenedor } from '@/features/catalogos/utils/tiposContenedorCanonico';
import type { TipoContenedorCanonico } from '@/features/catalogos/utils/tiposContenedorCanonico';
const state = vi.hoisted(() => ({ tipos: [] as TipoContenedorCanonico[] }));
vi.mock('@/features/catalogos/hooks', () => ({ useTiposContenedor: () => ({ data: state.tipos }) }));
vi.mock('../SeccionMercanciaWrapper', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
import SeccionMercanciaMaritimaFCL from '../SeccionMercanciaMaritimaFCL';

const GP = '00000000-0000-4000-8000-000000000001';
const DRY = '00000000-0000-4000-8000-000000000002';
const DV = '00000000-0000-4000-8000-000000000003';
const HC = '00000000-0000-4000-8000-000000000004';
const LCL = '00000000-0000-4000-8000-000000000005';
function Form({ initial = '' }: { initial?: string }) {
  const methods = useForm<CotizacionFormValues>({ defaultValues: { ...COTIZACION_FORM_DEFAULTS, tipoContenedor: initial } });
  return <FormProvider {...methods}><SeccionMercanciaMaritimaFCL msdsFile={null} setMsdsFile={vi.fn()} /><output data-testid="persistido">{methods.watch('tipoContenedor')}</output></FormProvider>;
}
async function openTipos() {
  fireEvent.click(screen.getAllByRole('combobox')[0]);
  return within(await screen.findByRole('listbox'));
}
beforeEach(() => {
  state.tipos = dedupeTiposContenedor([
    { id: GP, code: '20GP', name: "20' GP", activo: true, created_at: '2026-01-01' },
    { id: DRY, code: '20DRY', name: "20' Dry (Standard)", activo: true, created_at: '2026-01-01' },
    { id: DV, code: '20DV', name: "20' Dry (Standard)", activo: true, created_at: '2026-02-01' },
    { id: HC, code: '40HC', name: "40' High Cube", activo: true, created_at: '2026-01-01' },
    { id: LCL, code: 'LCL', name: 'LCL (Carga Consolidada)', activo: true, created_at: '2026-01-01' },
  ]);
});

describe('FCL comparte el catálogo activo y conserva datos guardados', () => {
  it('ofrece sólo los nombres del catálogo deduplicado, incluido Dry separado de GP', async () => {
    render(<Form />);
    const options = await openTipos();
    expect(options.getAllByRole('option').map((o) => o.textContent)).toEqual(["20' Dry (Standard)", "20' GP", "40' High Cube"]);
  });

  it('la selección nueva persiste el nombre Dry, no el UUID', async () => {
    render(<Form />);
    fireEvent.click((await openTipos()).getByText("20' Dry (Standard)"));
    expect(screen.getByTestId('persistido')).toHaveTextContent("20' Dry (Standard)");
    expect(screen.getByTestId('persistido')).not.toHaveTextContent(DRY);
  });

  it('mantiene selección GP y HC por nombre', async () => {
    render(<Form />);
    fireEvent.click((await openTipos()).getByText("20' GP"));
    expect(screen.getByTestId('persistido')).toHaveTextContent("20' GP");
    fireEvent.click((await openTipos()).getByText("40' High Cube"));
    expect(screen.getByTestId('persistido')).toHaveTextContent("40' High Cube");
  });

  it('un tipo excluido del catálogo no reaparece mediante la lista fija', async () => {
    state.tipos = state.tipos.filter((t) => t.id === HC);
    render(<Form />);
    expect((await openTipos()).getAllByRole('option').map((o) => o.textContent)).toEqual(["40' High Cube"]);
  });

  it('preserva un nombre legacy sin convertirlo ni duplicar la opción', async () => {
    render(<Form initial="20' Dry" />);
    expect(screen.getByTestId('persistido')).toHaveTextContent("20' Dry");
    expect((await openTipos()).getAllByRole('option', { name: "20' Dry", exact: true })).toHaveLength(1);
  });

  it('preserva UUID legacy equivalente y muestra Dry, nunca GP', async () => {
    render(<Form initial={DV} />);
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent("20' Dry (Standard)");
    expect(screen.getByTestId('persistido')).toHaveTextContent(DV);
    expect((await openTipos()).getAllByRole('option', { name: "20' Dry (Standard)", exact: true })).toHaveLength(1);
  });

  it('catálogo todavía vacío conserva el dato y no inventa opciones nuevas', async () => {
    state.tipos = [];
    render(<Form initial="Tipo legacy propio" />);
    expect((await openTipos()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Tipo legacy propio']);
    expect(screen.getByTestId('persistido')).toHaveTextContent('Tipo legacy propio');
  });

  it('excluye LCL de capturas FCL nuevas sin modificar el catálogo compartido', async () => {
    render(<Form />);
    expect((await openTipos()).queryByRole('option', { name: 'LCL (Carga Consolidada)' })).not.toBeInTheDocument();
    expect(state.tipos.some((tipo) => tipo.id === LCL)).toBe(true);
  });

  it.each([
    ['nombre', 'LCL (Carga Consolidada)', 'LCL (Carga Consolidada)'],
    ['UUID', LCL, 'LCL (Carga Consolidada)'],
    ['código', 'LCL', 'LCL'],
  ])('conserva LCL legacy por %s sin reescribirlo', async (_caso, valor, etiqueta) => {
    render(<Form initial={valor} />);
    expect(screen.getByTestId('persistido')).toHaveTextContent(valor);
    expect((await openTipos()).getAllByRole('option', { name: etiqueta, exact: true })).toHaveLength(1);
  });

  it('un UUID GP histórico sigue siendo GP y no se reescribe a Dry', async () => {
    render(<Form initial={GP} />);
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent("20' GP");
    expect(screen.getByTestId('persistido')).toHaveTextContent(GP);
    expect((await openTipos()).getAllByRole('option', { name: "20' GP", exact: true })).toHaveLength(1);
  });
});
