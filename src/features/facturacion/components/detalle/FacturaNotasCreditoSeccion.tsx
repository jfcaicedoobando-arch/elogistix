/**
 * FacturaNotasCreditoSeccion — lista las NCs ligadas a una factura y
 * permite crear, timbrar, descargar, reenviar y cancelar cada una.
 */
import { useMemo, useState } from "react";
import { FileMinus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { useNotasCreditoDeFactura } from "@/features/facturacion/hooks/useNotasCreditoDeFactura";
import { DialogCrearNotaCredito } from "@/features/facturacion/components/DialogCrearNotaCredito";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { DialogCancelarNotaCredito } from "@/features/facturacion/components/DialogCancelarNotaCredito";
import { useTimbrarNotaCredito, useCancelarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { FacturaNotasCreditoTable } from "./FacturaNotasCreditoTable";
import type { Tables } from "@/integrations/supabase/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";

type Moneda = Tables<"facturas">["moneda"];

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
}

function parseConceptosSugeridos(snapshot: unknown): ConceptoNotaCredito[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const list = (snapshot as { conceptos?: unknown }).conceptos;
  if (!Array.isArray(list)) return [];
  return (list as ConceptoSnapshot[]).map((c) => ({
    descripcion: c.descripcion ?? c.concepto ?? "",
    cantidad: Number(c.cantidad ?? 1),
    precio_unitario: Number(c.precio_unitario ?? c.precio ?? c.importe ?? 0),
    clave_sat: "84111506",
    clave_unidad: "E48",
    unidad: "Unidad de servicio",
    tasa_iva: TASA_IVA,
  })).filter((c) => c.descripcion);
}

interface Props {
  facturaId: string;
  facturaNumero: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  snapshotEmision: unknown;
  canEdit: boolean;
}

export function FacturaNotasCreditoSeccion(props: Props) {
  const { facturaId, facturaNumero, monedaFactura, tipoCambioFactura, saldoFactura, uuidFacturaOriginal, snapshotEmision, canEdit } = props;
  const [openCrear, setOpenCrear] = useState(false);
  const [emailNcId, setEmailNcId] = useState<string | null>(null);
  const [cancelarNcId, setCancelarNcId] = useState<string | null>(null);

  const timbrar = useTimbrarNotaCredito(facturaId);
  const cancelar = useCancelarNotaCredito(facturaId);

  const { data: notas = [], isLoading } = useNotasCreditoDeFactura(facturaId);

  const conceptosSugeridos = useMemo(
    () => parseConceptosSugeridos(snapshotEmision),
    [snapshotEmision],
  );

  const facturaLiquidada = saldoFactura <= 0.01;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileMinus className="h-4 w-4 text-muted-foreground" /> Notas de crédito
          <span className="text-xs text-muted-foreground font-normal">({notas.length})</span>
        </CardTitle>
        {canEdit && (
          facturaLiquidada ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button size="sm" disabled>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" onClick={() => setOpenCrear(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
            </Button>
          )
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : notas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta factura no tiene notas de crédito.</p>
        ) : (
          <FacturaNotasCreditoTable
            notas={notas}
            canEdit={canEdit}
            uuidFacturaOriginal={uuidFacturaOriginal}
            timbrando={timbrar.isPending}
            onTimbrar={(id) => timbrar.mutate(id)}
            onEmail={setEmailNcId}
            onCancelar={setCancelarNcId}
          />
        )}
      </CardContent>

      <DialogCrearNotaCredito
        open={openCrear}
        onOpenChange={setOpenCrear}
        facturaId={facturaId}
        facturaNumero={facturaNumero}
        monedaFactura={monedaFactura}
        tipoCambioFactura={tipoCambioFactura}
        saldoFactura={saldoFactura}
        uuidFacturaOriginal={uuidFacturaOriginal}
        conceptosSugeridos={conceptosSugeridos}
      />

      <DialogEnviarCfdi
        open={!!emailNcId}
        onOpenChange={(o) => !o && setEmailNcId(null)}
        notaCreditoId={emailNcId ?? undefined}
        titulo="Reenviar nota de crédito"
      />

      <DialogCancelarNotaCredito
        open={!!cancelarNcId}
        onOpenChange={(o) => !o && setCancelarNcId(null)}
        loading={cancelar.isPending}
        onConfirm={(motivo, sustituyeUuid) => {
          if (!cancelarNcId) return;
          cancelar.mutate(
            { notaCreditoId: cancelarNcId, motivo, sustituyeUuid },
            { onSuccess: () => setCancelarNcId(null) },
          );
        }}
      />
    </Card>
  );
}
