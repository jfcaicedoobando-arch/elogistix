import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Clock, User } from 'lucide-react';
import { useEventosEmbarque, useCreateEventoEmbarque, TIPOS_EVENTO_TRACKING } from '@/hooks/embarque/useEventosEmbarque';
import { ICONO_EVENTO } from "@/constants/embarqueConstants";
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/shared/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, nombreDesdeEmail } from '@/lib/formatters';
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { TrackingLiveCard } from './TrackingLiveCard';
import { TrackingFasesTimeline } from './TrackingFasesTimeline';
import { TabNotas } from './TabNotas';
import type { Tables } from '@/integrations/supabase/types';
import type { NotaEmbarqueRow } from '@/hooks/embarque/useEmbarques';

type EmbarqueTrackingProps = Pick<
  Tables<'embarques'>,
  'modo' | 'tipo' | 'estado' | 'naviera' | 'contenedor' | 'bl_master' | 'etd' | 'eta' | 'fecha_llegada_real' | 'fecha_creacion' | 'cotizacion_id' | 'updated_at'
>;

interface Props {
  embarqueId: string;
  embarque?: EmbarqueTrackingProps | null;
  notas?: NotaEmbarqueRow[];
}

const eventoSchema = z.object({
  tipo: z.string().min(1, 'Selecciona un tipo de evento'),
  fecha: z.string().min(1, 'Fecha requerida'),
  ubicacion: z.string().max(120, 'Máximo 120 caracteres').optional().default(''),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional().default(''),
});

type EventoFormValues = z.infer<typeof eventoSchema>;

const defaultEventoValues = (): EventoFormValues => ({
  tipo: '',
  fecha: new Date().toISOString().slice(0, 16),
  ubicacion: '',
  descripcion: '',
});


export function TabTracking({ embarqueId, embarque, notas = [] }: Props) {
  const { data: eventos = [], isLoading } = useEventosEmbarque(embarqueId);
  const crearEvento = useCreateEventoEmbarque();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const { toast } = useToast();

  const [formAbierto, setFormAbierto] = useState(false);
  const [tipo, setTipo] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));

  function renderTimeline() {
    if (isLoading) return <EmptyStateInline loading message="Cargando eventos..." />;
    if (eventos.length === 0) {
      return <EmptyStateInline icon={Clock} message="No hay eventos de tracking registrados." />;
    }
    return (
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {eventos.map((ev, i) => (
            <div key={ev.id} className="relative pl-10">
              {/* Punto en la línea */}
              <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${
                i === 0 ? 'bg-accent' : 'bg-muted-foreground/40'
              }`} />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? '📝'}</span>
                  <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
                  </span>
                </div>

                {ev.descripcion && (
                  <p className="text-sm text-foreground">{ev.descripcion}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {ev.ubicacion && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {ev.ubicacion}
                    </span>
                  )}
                  {ev.usuario && (
                    <span className="flex items-center gap-1" title={ev.usuario}>
                      <User className="h-3 w-3" /> {nombreDesdeEmail(ev.usuario)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return;
    try {
      await crearEvento.mutateAsync({
        embarqueId,
        tipo,
        descripcion,
        ubicacion,
        fecha: new Date(fecha).toISOString(),
        usuario: user?.email ?? '',
      });
      notifySuccess(toast, { title: 'Evento registrado' });
      setFormAbierto(false);
      setTipo('');
      setDescripcion('');
      setUbicacion('');
      setFecha(new Date().toISOString().slice(0, 16));
    } catch (err: unknown) {
      notifyError(toast, { title: 'Error al registrar evento', description: getErrorMessage(err)});
    }
  };

  return (
    <div className="space-y-6">
      {embarque && (
        <TrackingFasesTimeline
          embarque={{
            modo: embarque.modo,
            tipo: embarque.tipo,
            estado: embarque.estado,
            etd: embarque.etd,
            eta: embarque.eta,
            fecha_creacion: embarque.fecha_creacion,
            fecha_llegada_real: embarque.fecha_llegada_real,
            cotizacion_id: embarque.cotizacion_id,
            updated_at: embarque.updated_at,
          }}
        />
      )}
      {embarque && (
        <TrackingLiveCard
          embarqueId={embarqueId}
          modo={embarque.modo}
          naviera={embarque.naviera}
          contenedor={embarque.contenedor}
          blMaster={embarque.bl_master}
          etd={embarque.etd}
          eta={embarque.eta}
          fechaLlegadaReal={embarque.fecha_llegada_real}
        />
      )}
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormAbierto(!formAbierto)}>
            <Plus className="h-4 w-4 mr-1" /> Registrar Evento
          </Button>
        </div>
      )}

      {formAbierto && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nuevo Evento de Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de evento *</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO_TRACKING.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ICONO_EVENTO[t]} {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha y hora *</label>
                <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ubicación</label>
                <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Puerto, ciudad, terminal..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles del evento..." rows={2} />
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setFormAbierto(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={!tipo || crearEvento.isPending}>
                  {crearEvento.isPending ? 'Guardando...' : 'Guardar Evento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Línea de Tiempo</CardTitle>
        </CardHeader>
        <CardContent>{renderTimeline()}</CardContent>
      </Card>

      <TabNotas notas={notas} embarqueId={embarqueId} />
    </div>
  );
}
