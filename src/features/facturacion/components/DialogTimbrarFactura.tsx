/**
 * DialogTimbrarFactura — Revisión previa al timbrado CFDI 4.0.
 * Migrado a `FormDialogShell` (v13.120.0).
 */
import { useState, useEffect } from "react";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  fetchDefaultsFacturacionCliente,
  guardarDefaultsTimbradoCliente,
  type ClienteFiscalRow,
  type DefaultsFacturacionCliente,
} from "@/features/facturacion/services";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { buildChecksTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";
import { TimbrarCompacto, TimbrarCompleto } from "./DialogTimbrarFactura.parts";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type FiscalCliente = ClienteFiscalRow;

export function DialogTimbrarFactura({ facturaId, open, onOpenChange }: Props) {
  const timbrar = useTimbrarFactura();
  const { data: factura } = useFactura(facturaId ?? undefined);

  const { data: cliente } = useQuery<FiscalCliente | null>({
    queryKey: ["cliente_fiscal", factura?.cliente_id],
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchClienteFiscal(factura!.cliente_id),
  });

  // Defaults resueltos (preferencia guardada del cliente > última factura timbrada).
  // Se usan como fallback cuando la factura aún no tiene uso_cfdi/forma_pago/metodo_pago.
  const { data: defaults } = useQuery<DefaultsFacturacionCliente | null>({
    queryKey: ["cliente_defaults_facturacion", factura?.cliente_id],
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchDefaultsFacturacionCliente(factura!.cliente_id),
    staleTime: 30_000,
  });

  const { toast } = useToast();
  const [usoCfdi, setUsoCfdi] = useState(
    factura?.uso_cfdi ?? defaults?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03",
  );
  const [formaPago, setFormaPago] = useState(factura?.forma_pago ?? defaults?.forma_pago ?? "03");
  const [metodoPago, setMetodoPago] = useState(factura?.metodo_pago ?? defaults?.metodo_pago ?? "PUE");
  const [enviarEmail, setEnviarEmail] = useState(true);
  // Modo inteligente: si todo está listo mostramos confirmación compacta;
  // "Editar datos fiscales" abre el modo completo (analogía: firmar contrato
  // ante notario — si el borrador está limpio sólo confirmas; si falta un
  // dato, se abre el pliego completo).
  const [modoExpandido, setModoExpandido] = useState(false);

  // Re-sincronizar cuando llegan (o cambian) los datos persistidos por
  // la tarjeta "Configuración de timbrado". `useState` sólo lee su valor
  // inicial una vez, así que sin este efecto el modal se quedaría con los
  // fallbacks (G03/03/PUE) cuando se monta antes de que useFactura resuelva.
  useEffect(() => {
    if (!factura) return;
    setUsoCfdi(factura.uso_cfdi ?? defaults?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03");
    setFormaPago(factura.forma_pago ?? defaults?.forma_pago ?? "03");
    setMetodoPago(factura.metodo_pago ?? defaults?.metodo_pago ?? "PUE");
    setModoExpandido(false);
    // Nos apoyamos en las claves granulares para evitar re-disparos por
    // cambios de identidad del objeto `factura` (query invalidations).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    factura?.id,
    factura?.uso_cfdi,
    factura?.forma_pago,
    factura?.metodo_pago,
    cliente?.uso_cfdi_default,
    defaults?.uso_cfdi,
    defaults?.forma_pago,
    defaults?.metodo_pago,
  ]);

  if (!facturaId || !factura) return null;

  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi,
    formaPago,
    metodoPago,
    moneda: factura.moneda ?? "MXN",
    tipoCambio: factura.tipo_cambio == null ? null : Number(factura.tipo_cambio),
  });

  const onConfirm = async () => {
    await actualizarDatosTimbradoFactura(facturaId, {
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
    });
    timbrar.mutate(facturaId, {
      onSuccess: async () => {
        // Best-effort: guarda los valores usados como preferencia del cliente
        // para prellenar la siguiente factura. No debe romper el flujo si falla.
        if (factura.cliente_id) {
          try {
            await guardarDefaultsTimbradoCliente(factura.cliente_id, {
              uso_cfdi_default: usoCfdi,
              forma_pago_default: formaPago,
              metodo_pago_default: metodoPago,
            });
          } catch (err) {
            console.warn("[timbrado] no se guardaron los defaults del cliente:", err);
          }
        }
        if (enviarEmail) {
          try {
            const r = await enviarCfdiFactura(facturaId);
            toast({ title: "CFDI enviado", description: `Enviado a ${r.enviado_a}.` });
          } catch (err) {
            notifyError(toast, {
              title: "Factura timbrada, pero no se envió el email",
              description: getErrorMessage(err),
              method: "ON_ERROR",
              errorCode: ERROR_CODES.VALIDATION_FAILED,
            });
          }
        }
        onOpenChange(false);
      },
    });
  };

  const esFastPath =
    puedeTimbrar &&
    Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago);
  const mostrarCompacto = esFastPath && !modoExpandido;

  const footer = (
    <>
      {mostrarCompacto && (
        <Button
          variant="ghost"
          onClick={() => setModoExpandido(true)}
          className="mr-auto"
        >
          Editar datos fiscales
        </Button>
      )}
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={onConfirm} disabled={!puedeTimbrar || timbrar.isPending}>
        {timbrar.isPending ? "Timbrando…" : "Timbrar ahora"}
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
          usoCfdi={usoCfdi}
          formaPago={formaPago}
          metodoPago={metodoPago}
          enviarEmail={enviarEmail}
          setEnviarEmail={setEnviarEmail}
        />
      ) : (
        <TimbrarCompleto
          checks={checks}
          usoCfdi={usoCfdi}
          setUsoCfdi={setUsoCfdi}
          formaPago={formaPago}
          setFormaPago={setFormaPago}
          metodoPago={metodoPago}
          setMetodoPago={setMetodoPago}
          enviarEmail={enviarEmail}
          setEnviarEmail={setEnviarEmail}
          puedeTimbrar={puedeTimbrar}
        />
      )}
    </FormDialogShell>
  );
}
