import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TabNotas } from '../TabNotas';
import { TrackingNuevoEventoForm } from '../tracking/TrackingNuevoEventoForm';
import { ActividadItem } from '../ActividadItem';

const m = vi.hoisted(() => ({ nota: vi.fn(), audit: vi.fn(), eta: vi.fn(), evento: vi.fn(), close: vi.fn() }));
vi.mock('@/hooks/shared', () => ({ usePermissions: () => ({ canEdit: true }), useRegistrarActividad: () => ({ mutate: m.audit }) }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'coordinador@example.com' } }) }));
vi.mock('@/features/embarques/hooks', () => ({
  useCreateNotaEmbarque: () => ({ mutateAsync: m.nota, isPending: false }),
  useActividadEmbarque: () => ({ grupos: [], conteos: {}, categoria: 'todos', setCategoria: vi.fn(), items: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateEventoEmbarque: () => ({ mutateAsync: m.evento, isPending: false }),
}));
vi.mock('../../hooks/mutations/useActualizarEta', () => ({ useActualizarEta: () => ({ mutateAsync: m.eta, isPending: false }) }));
vi.mock('../../hooks/mutations/useActualizarFechaLlegadaReal', () => ({ useActualizarFechaLlegadaReal: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../tracking/ActualizarEtaForm', () => ({ ActualizarEtaForm: ({ onSubmit }: { onSubmit: (v: { fecha: string; fuente: string }) => Promise<void> }) => <button onClick={() => void onSubmit({ fecha: '2026-11-20', fuente: 'Agente Ningbo' })}>Guardar ETA mock</button> }));
vi.mock('@/lib/ui/appFeedback', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

const id = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { vi.clearAllMocks(); m.nota.mockResolvedValue(id); m.eta.mockResolvedValue(undefined); m.evento.mockResolvedValue(undefined); });
describe('correlación desde los callers reales', () => {
  it('la bitácora de UI usa el ID confirmado de la nota', async () => {
    render(<TabNotas notas={[]} embarqueId="e1" expediente="ELIMP00011" />);
    fireEvent.change(screen.getByPlaceholderText('Escribe una nota…'), { target: { value: 'Cita de entrega en Apodaca' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar nota' })); });
    await vi.waitFor(() => expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ detalles: { nota: 'Cita de entrega en Apodaca', notaId: id } })));
  });

  it('ETA y evento reciben el mismo ID, y la operación conserva su orden', async () => {
    render(<TrackingNuevoEventoForm embarqueId="e1" etaActual="2026-11-18" onClose={m.close} />);
    fireEvent.click(screen.getByRole('button', { name: /Actualizar ETA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ETA mock' }));
    await vi.waitFor(() => expect(m.close).toHaveBeenCalledOnce());
    const eventoId = m.eta.mock.calls[0][0].eventoId;
    expect(eventoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.evento).toHaveBeenCalledWith(expect.objectContaining({ eventoId, embarqueId: 'e1', tipo: 'Cambio de ETA' }));
    expect(m.eta.mock.invocationCallOrder[0]).toBeLessThan(m.evento.mock.invocationCallOrder[0]);
  });

  it('un UPDATE ETA fallido no crea evento ni cierra el formulario', async () => {
    m.eta.mockRejectedValue(new Error('No se pudo guardar'));
    render(<TrackingNuevoEventoForm embarqueId="e1" onClose={m.close} />);
    fireEvent.click(screen.getByRole('button', { name: /Actualizar ETA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ETA mock' }));
    await vi.waitFor(() => expect(m.eta).toHaveBeenCalledOnce());
    expect(m.evento).not.toHaveBeenCalled();
    expect(m.close).not.toHaveBeenCalled();
  });

  it('las transiciones de cotización no se rotulan como cambio del embarque', () => {
    render(<ul><ActividadItem item={{ id: 'bitc-1', categoria: 'comercial', tipo: 'bitacora', fecha: '2026-09-27T02:50:30Z', usuario: '', accion: 'cambiar_estado', titulo: 'Cotización: cambiar_estado', refTipo: 'cotizacion' }} /></ul>);
    expect(screen.getByText('Cambio de estado de la cotización')).toBeInTheDocument();
    expect(screen.queryByText(/estado del embarque/)).not.toBeInTheDocument();
  });

  it('permite consultar el JSON completo de las bitácoras relacionadas', () => {
    render(<ul><ActividadItem item={{ id: `nota-${id}`, categoria: 'operacion', tipo: 'nota', fecha: '2026-09-27T02:50:30Z', usuario: '', accion: 'Nota', titulo: 'Cita en Apodaca', relacionados: [{ id: 'bit-1', categoria: 'operacion', tipo: 'bitacora', fecha: '2026-09-27T02:50:30Z', usuario: '', accion: 'agregar_nota', titulo: 'Nota registrada', detalles: { notaId: id, usuario: 'Coordinación' } }] }} /></ul>);
    const summary = screen.getByText('Ver 1 registro relacionado');
    fireEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    const tecnico = screen.getByText('Ver detalle técnico');
    fireEvent.click(tecnico);
    expect(tecnico.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(new RegExp(id))).toBeVisible();
  });
});
