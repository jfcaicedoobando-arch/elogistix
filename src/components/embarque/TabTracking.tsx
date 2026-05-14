import { useState } from 'react';
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
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  embarqueId: string;
  embarque?: Pick<Tables<'embarques'>, 'modo' | 'naviera' | 'contenedor' | 'bl_master' | 'etd' | 'eta' | 'fecha_llegada_real'> | null;
}


export function TabTracking({ embarqueId, embarque }: Props) {
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
    </div>
  );
}
