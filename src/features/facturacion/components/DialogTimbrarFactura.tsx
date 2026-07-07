/**
 * DialogTimbrarFactura — Revisión previa al timbrado CFDI 4.0.
 * Migrado a `FormDialogShell` (v13.120.0). El estado y el handler viven
 * en `useTimbrarFacturaDialog` para respetar el límite de 200 líneas.
 */
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import {
  fetchClienteFiscal,
  fetchDefaultsFacturacionCliente,
  type ClienteFiscalRow,
  type DefaultsFacturacionCliente,
} from "@/features/facturacion/services";
import { useQuery } from "@tanstack/react-query";
import { buildChecksTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";
import { useTimbrarFacturaDialog } from "@/features/facturacion/hooks/useTimbrarFacturaDialog";
import { TimbrarCompacto, TimbrarCompleto } from "./DialogTimbrarFactura.parts";
import { ReferenciasEmbarquePreview } from "./ReferenciasEmbarquePreview";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogTimbrarFactura({ facturaId, open, onOpenChange }: Props) {
  const { data: factura } = useFactura(facturaId ?? undefined);

  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: ["cliente_fiscal", factura?.cliente_id],
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchClienteFiscal(factura!.cliente_id),
  });

  const { data: defaults } = useQuery<DefaultsFacturacionCliente | null>({
    queryKey: ["cliente_defaults_facturacion", factura?.cliente_id],
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchDefaultsFacturacionCliente(factura!.cliente_id),
    staleTime: 30_000,
  });

  const dlg = useTimbrarFacturaDialog(factura, cliente, defaults, () => onOpenChange(false));

  if (!facturaId || !factura) return null;

  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi: dlg.usoCfdi,
    formaPago: dlg.formaPago,
    metodoPago: dlg.metodoPago,
    moneda: factura.moneda ?? "MXN",
    tipoCambio: factura.tipo_cambio == null ? null : Number(factura.tipo_cambio),
  });

  const esFastPath =
    puedeTimbrar &&
    Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago);
  const mostrarCompacto = esFastPath && !dlg.modoExpandido;

  const footer = (
    <>
      {mostrarCompacto && (
        <Button variant="ghost" onClick={() => dlg.setModoExpandido(true)} className="mr-auto">
          Editar datos fiscales
        </Button>
      )}
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={dlg.onConfirm} disabled={!puedeTimbrar || dlg.timbrarPending}>
        {dlg.timbrarPending ? "Timbrando…" : "Timbrar ahora"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Stamp}
      title={`Timbrar factura ${factura.numero}`}
      description={
        mostrarCompacto
          ? "Todo listo para emitir el CFDI 4.0 vía Facturapi."
          : "Revisa los datos fiscales antes de emitir el CFDI 4.0 a través de Facturapi."
      }
      size={mostrarCompacto ? "md" : "lg"}
      footer={footer}
    >
      {mostrarCompacto ? (
        <TimbrarCompacto
          usoCfdi={dlg.usoCfdi}
          formaPago={dlg.formaPago}
          metodoPago={dlg.metodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
        />
      ) : (
        <TimbrarCompleto
          checks={checks}
          usoCfdi={dlg.usoCfdi}
          setUsoCfdi={dlg.setUsoCfdi}
          formaPago={dlg.formaPago}
          setFormaPago={dlg.setFormaPago}
          metodoPago={dlg.metodoPago}
          setMetodoPago={dlg.setMetodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
          puedeTimbrar={puedeTimbrar}
        />
      )}
      <ReferenciasEmbarquePreview factura={factura} />
    </FormDialogShell>
  );
}
