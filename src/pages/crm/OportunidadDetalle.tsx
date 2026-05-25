/**
 * /crm/oportunidades/:id — Detalle de oportunidad con edición y conversión a cotización.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared";
import { formatCurrencyCompact } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NuevaOportunidadDialog from "@/components/crm/NuevaOportunidadDialog";
import ActividadTimeline from "@/components/crm/ActividadTimeline";
import { OportunidadLineageCard } from "@/components/crm/LineageCard";
import { useOportunidad, useEliminarOportunidad } from "@/hooks/crm/useOportunidades";
import { useEtapasPipeline } from "@/hooks/crm/useEtapasPipeline";
import { generarFolioCotizacion } from "@/services/cotizacion/queries";

export default function OportunidadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [creandoCot, setCreandoCot] = useState(false);

  const { data: op, isLoading } = useOportunidad(id);
  const { data: etapas = [] } = useEtapasPipeline();
  const eliminar = useEliminarOportunidad();

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!op) return <div className="p-8 text-center text-sm text-muted-foreground">Oportunidad no encontrada</div>;

  const etapa = etapas.find((e) => e.id === op.etapa_id);

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(op.id);
      notifySuccess(toast, { title: "Oportunidad eliminada" });
      navigate("/crm/oportunidades");
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  const crearCotizacion = async () => {
    setCreandoCot(true);
    try {
      const folio = await generarFolioCotizacion();
      const modoMap: Record<string, "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal"> = {
        "Marítimo": "Marítimo", "Aéreo": "Aéreo", "Terrestre": "Terrestre", "Multimodal": "Multimodal",
      };
      const modo = modoMap[op.modo] ?? "Marítimo";
      const { data, error } = await supabase
        .from("cotizaciones")
        .insert({
          folio,
          modo,
          tipo: "Importación",
          cliente_id: op.cliente_id,
          cliente_nombre: op.cliente_nombre || "",
          origen: op.origen || "",
          destino: op.destino || "",
          oportunidad_id: op.id,
          operador: user?.email ?? "",
          es_prospecto: !op.cliente_id,
        })
        .select("id")
        .single();
      if (error) throw error;
      notifySuccess(toast, { title: "Cotización creada", description: `Folio ${folio}` });
      navigate(`/cotizaciones/${data.id}/editar`);
    } catch (e) {
      notifyError(toast, { title: "No se pudo crear", description: e instanceof Error ? e.message : undefined });
    } finally {
      setCreandoCot(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<ArrowLeft className="h-5 w-5 cursor-pointer" onClick={() => navigate("/crm/oportunidades")} />}
        title={op.nombre}
        description={op.cliente_nombre || "Sin cliente"}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={crearCotizacion} disabled={creandoCot}>
                {creandoCot ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                Crear cotización
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button variant="destructive" onClick={() => setDelOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Etapa</CardTitle></CardHeader>
          <CardContent><Badge style={{ backgroundColor: etapa?.color }}>{etapa?.nombre ?? "—"}</Badge></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Monto estimado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrencyCompact(Number(op.monto_estimado ?? 0), op.moneda)}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ponderado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatCurrencyCompact(Number(op.monto_estimado ?? 0) * (op.probabilidad / 100), op.moneda)}
            <div className="text-xs text-muted-foreground">{op.probabilidad}% probabilidad</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Datos comerciales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-muted-foreground text-xs">Vendedor</div>{op.vendedor_email || "—"}</div>
          <div><div className="text-muted-foreground text-xs">Modo</div>{op.modo || "—"}</div>
          <div><div className="text-muted-foreground text-xs">Cierre estimado</div>{op.fecha_estimada_cierre || "—"}</div>
          <div><div className="text-muted-foreground text-xs">Origen</div>{op.origen || "—"}</div>
          <div><div className="text-muted-foreground text-xs">Destino</div>{op.destino || "—"}</div>
          <div className="col-span-2 md:col-span-3"><div className="text-muted-foreground text-xs">Notas</div>{op.notas || "—"}</div>
        </CardContent>
      </Card>

      <OportunidadLineageCard oportunidadId={op.id} leadId={op.lead_id ?? null} />

      <ActividadTimeline entidadTipo="oportunidad" entidadId={op.id} />

      <NuevaOportunidadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        oportunidad={op}
      />
      <DoubleConfirmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        onConfirm={handleEliminar}
        entityName={op.nombre}
      />
    </div>
  );
}
