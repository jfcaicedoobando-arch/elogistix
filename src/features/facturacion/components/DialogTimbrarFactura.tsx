/**
 * DialogTimbrarFactura — Revisión previa al timbrado CFDI 4.0.
 * Migrado a `FormDialogShell` (v13.120.0).
 */
import { useState } from "react";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { buildChecksTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";

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

  const { toast } = useToast();
  const [usoCfdi, setUsoCfdi] = useState(factura?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03");
  const [formaPago, setFormaPago] = useState(factura?.forma_pago ?? "03");
  const [metodoPago, setMetodoPago] = useState(factura?.metodo_pago ?? "PUE");
  const [enviarEmail, setEnviarEmail] = useState(true);

  if (!facturaId || !factura) return null;

  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi,
    formaPago,
    metodoPago,
  });

  const onConfirm = async () => {
    await actualizarDatosTimbradoFactura(facturaId, {
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
    });
    timbrar.mutate(facturaId, {
      onSuccess: async () => {
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

  const footer = (
    <>
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
      description="Revisa los datos fiscales antes de emitir el CFDI 4.0 a través de Facturapi."
      size="lg"
      footer={footer}
    >
      <ul className="text-sm space-y-1">
        {checks.map((c, i) => (
          <li key={i} className={c.ok ? "text-success" : "text-destructive"}>
            {c.ok ? "✓" : "✗"} {c.label}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Uso CFDI</Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Forma de pago</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Método de pago</Label>
          <Select value={metodoPago} onValueChange={setMetodoPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={enviarEmail}
          onCheckedChange={(c) => setEnviarEmail(c === true)}
        />
        <span>Enviar el CFDI por email al cliente tras timbrar</span>
      </label>


      {!puedeTimbrar && (
        <Alert variant="destructive">
          <AlertDescription>
            Completa los datos fiscales del cliente antes de timbrar.
            Puedes hacerlo en el detalle del cliente.
          </AlertDescription>
        </Alert>
      )}
    </FormDialogShell>
  );
}
