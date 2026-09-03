import { useState, useMemo } from "react";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import ComentariosOportunidad from "@/features/crm/components/ComentariosOportunidad";
import { OportunidadLineageCard } from "@/features/crm/components/LineageCard";
import { OportunidadKpisCards } from "./OportunidadKpisCards";
import { OportunidadGanadaBanner } from "./OportunidadGanadaBanner";
import { ContactoRapidoCard } from "./ContactoRapidoCard";
import { OportunidadDetalleAcciones } from "./OportunidadDetalleAcciones";
import { OportunidadResumenTab } from "./OportunidadResumenTab";

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
  // Espejo de las policies de `crm_oportunidades`: staff CRM sobre cualquiera,
  // vendedor sólo las propias. `canEdit` ofrecía editar a roles sin policy.
  const { canGestionarOportunidad, canEditSales } = usePermissions();
  const canEdit = canGestionarOportunidad(op.vendedor_id);
  // "Nueva cotización" usa el permiso de escritura de cotizaciones (SALES),
  // independiente de la gestión de la oportunidad (ej. gerente_operaciones).
  const canCotizar = canEditSales;
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
        trailing={(canEdit || canCotizar) ? (
          <OportunidadDetalleAcciones
            crearCotizacion={actions.crearCotizacion}
            crearCotPending={actions.crearCotPending}
            onEditar={() => setEditOpen(true)}
            onEliminar={() => setDelOpen(true)}
            canCotizar={canCotizar}
            canGestionar={canEdit}
          />
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
          <OportunidadResumenTab op={op} etapaNombre={etapa?.nombre} canEdit={canEdit} />
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
