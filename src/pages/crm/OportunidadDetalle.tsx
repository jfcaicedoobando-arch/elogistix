/**
 * /crm/oportunidades/:id — Detalle de oportunidad con tabs internas.
 * Resumen / Comunicación / Trazabilidad para reducir scroll.
 */
import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import NuevaOportunidadDialog from "@/components/crm/NuevaOportunidadDialog";
import ActividadTimeline from "@/components/crm/ActividadTimeline";
import ComentariosOportunidad from "@/components/crm/ComentariosOportunidad";
import OportunidadCotizacionesList from "@/components/crm/OportunidadCotizacionesList";
import { OportunidadLineageCard } from "@/components/crm/LineageCard";
import { OportunidadKpisCards } from "@/components/crm/oportunidadDetalle/OportunidadKpisCards";
import { ContactoRapidoCard } from "@/components/crm/oportunidadDetalle/ContactoRapidoCard";
import { useOportunidad, useEtapasPipeline, useOportunidadDetalleActions } from "@/hooks/crm";
import { useContactosCliente } from "@/hooks/cliente";

export default function OportunidadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const { data: op, isLoading } = useOportunidad(id);
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: contactos = [] } = useContactosCliente(op?.cliente_id ?? undefined);
  const contactoPrincipal = useMemo(() => contactos[0], [contactos]);

  const actions = useOportunidadDetalleActions(
    {
      id: op?.id ?? "",
      cliente_id: op?.cliente_id,
      cliente_nombre: op?.cliente_nombre,
      origen: op?.origen,
      destino: op?.destino,
      etapa_id: op?.etapa_id ?? "",
      modo: op?.modo ?? "",
    },
    etapas,
  );

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!op) return <div className="p-8 text-center text-sm text-muted-foreground">Oportunidad no encontrada</div>;

  const etapa = etapas.find((e) => e.id === op.etapa_id);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<ArrowLeft className="h-5 w-5 cursor-pointer" onClick={() => navigate("/crm/oportunidades")} />}
        title={op.nombre}
        description={op.cliente_nombre || "Sin cliente"}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={actions.crearCotizacion} disabled={actions.crearCotPending}>
                {actions.crearCotPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
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

      <OportunidadKpisCards
        etapa={etapa}
        montoEstimado={Number(op.monto_estimado ?? 0)}
        valorReal={op.valor_real != null ? Number(op.valor_real) : null}
        probabilidad={op.probabilidad}
        moneda={op.moneda}
      />

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="comunicacion">Comunicación</TabsTrigger>
          <TabsTrigger value="trazabilidad">Trazabilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4 space-y-4">
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
          <OportunidadCotizacionesList oportunidadId={op.id} />
        </TabsContent>

        <TabsContent value="comunicacion" className="mt-4 space-y-4">
          {op.cliente_id && (
            <ContactoRapidoCard
              contacto={contactoPrincipal}
              oportunidadId={op.id}
              clienteNombre={op.cliente_nombre}
              vendedorEmail={op.vendedor_email}
              etapaNombre={etapa?.nombre}
              montoEstimado={Number(op.monto_estimado ?? 0)}
              moneda={op.moneda}
            />
          )}
          <ComentariosOportunidad oportunidadId={op.id} canEdit={canEdit} />
          <ActividadTimeline entidadTipo="oportunidad" entidadId={op.id} />
        </TabsContent>

        <TabsContent value="trazabilidad" className="mt-4">
          <OportunidadLineageCard oportunidadId={op.id} leadId={op.lead_id ?? null} />
        </TabsContent>
      </Tabs>

      <NuevaOportunidadDialog open={editOpen} onOpenChange={setEditOpen} oportunidad={op} />
      <DoubleConfirmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        onConfirm={actions.handleEliminar}
        entityName={op.nombre}
      />
    </div>
  );
}
