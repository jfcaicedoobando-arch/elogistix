import { useState, useMemo } from "react";
import { Edit, ClipboardList, Loader2, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import ComentariosOportunidad from "@/features/crm/components/ComentariosOportunidad";
import OportunidadCotizacionesList from "@/features/crm/components/OportunidadCotizacionesList";
import { OportunidadLineageCard } from "@/features/crm/components/LineageCard";
import { OportunidadKpisCards } from "./OportunidadKpisCards";
import { OportunidadGanadaBanner } from "./OportunidadGanadaBanner";
import { DatosComercialesCard } from "./DatosComercialesCard";
import { ContactoRapidoCard } from "./ContactoRapidoCard";
import { useOportunidadDetalleActions } from "@/features/crm/hooks";
import { useContactosCliente } from "@/features/cliente/hooks";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

interface Etapa {
  id: string;
  nombre: string;
  tipo: string;
  color?: string | null;
  probabilidad_default?: number | null;
}

interface Props {
  op: CrmOportunidadRow;
  etapas: Etapa[];
}

export function OportunidadDetalleContent({ op, etapas }: Props) {
  const { canEdit } = usePermissions();
  const volver = useVolver("/crm/oportunidades");
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const { data: contactos = [] } = useContactosCliente(op.cliente_id ?? undefined);
  const contactoPrincipal = useMemo(() => contactos[0], [contactos]);

  const actions = useOportunidadDetalleActions(
    {
      id: op.id,
      cliente_id: op.cliente_id,
      cliente_nombre: op.cliente_nombre,
      origen: op.origen,
      destino: op.destino,
      etapa_id: op.etapa_id,
      modo: op.modo ?? "",
    },
    etapas,
  );

  const etapa = etapas.find((e) => e.id === op.etapa_id);
  const montoEstimado = Number(op.monto_estimado ?? 0);

  return (
    <div className="space-y-4 p-6">
      <DetailHeader
        backTo={volver}
        backLabel="Volver a Oportunidades"
        icon={<Target className="h-6 w-6 text-accent shrink-0" />}
        title={op.nombre}
        titleAs="h2"

        badge={etapa ? <Badge variant="outline">{etapa.nombre}</Badge> : undefined}
        subtitle={op.cliente_nombre || "Sin cliente"}
        trailing={canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={actions.crearCotizacion} disabled={actions.crearCotPending}>
              {actions.crearCotPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ClipboardList className="h-4 w-4 mr-1" />}
              Crear cotización
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDelOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </div>
        ) : undefined}
      />


      <OportunidadGanadaBanner
        cotizacionGanadoraId={op.cotizacion_ganadora_id ?? null}
        embarqueGanadorId={op.embarque_ganador_id ?? null}
      />

      <OportunidadKpisCards
        etapa={etapa}
        montoEstimado={montoEstimado}
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
          <DatosComercialesCard
            fields={[
              { label: "Vendedor", value: op.vendedor_email },
              { label: "Modo", value: op.modo },
              { label: "Cierre estimado", value: op.fecha_estimada_cierre },
              { label: "Origen", value: op.origen },
              { label: "Destino", value: op.destino },
              { label: "Notas", value: op.notas, colSpan: true },
            ]}
          />
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
              montoEstimado={montoEstimado}
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
