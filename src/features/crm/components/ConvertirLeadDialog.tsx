/**
 * Diálogo para convertir un Lead en (opcional) Cliente + Oportunidad (CRM Fase 2).
 * Si el lead ya está convertido, muestra los IDs resultantes en lugar del form.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useConvertirLead, type CrmLeadRow } from "@/features/crm/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CrmLeadRow;
}

export default function ConvertirLeadDialog({ open, onOpenChange, lead }: Props) {
  const [crearCliente, setCrearCliente] = useState(true);
  const [nombre, setNombre] = useState(`Oportunidad — ${lead.empresa}`);
  const [monto, setMonto] = useState<string>("0");
  const [moneda, setMoneda] = useState<"MXN" | "USD" | "EUR">("MXN");
  const [fecha, setFecha] = useState<string>("");
  const convertir = useConvertirLead();
  const navigate = useNavigate();

  const yaConvertido = lead.estado === "Convertido" && lead.oportunidad_convertida_id;

  const handle = async () => {
    try {
      const r = await convertir.mutateAsync({
        lead,
        crearCliente,
        clienteIdExistente: lead.cliente_convertido_id ?? null,
        nombreOportunidad: nombre.trim() || `Oportunidad — ${lead.empresa}`,
        montoEstimado: Number(monto) || 0,
        moneda,
        fechaEstimadaCierre: fecha || null,
      });
      crmToast.success("Lead convertido");
      onOpenChange(false);
      if (r.clienteId) navigate(`/clientes/${r.clienteId}`);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo convertir el lead",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE",
      });
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
      {!yaConvertido && (
        <Button onClick={handle} disabled={convertir.isPending}>
          {convertir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Convertir
        </Button>
      )}
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserPlus}
      title="Convertir lead"
      description={
        yaConvertido
          ? "Este lead ya fue convertido."
          : "Crea opcionalmente un cliente y genera la primera oportunidad asociada."
      }
      size="xl"
      footer={footer}
    >
      {yaConvertido ? (
        <div className="space-y-3 text-sm">
          {lead.cliente_convertido_id && (
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/clientes/${lead.cliente_convertido_id}`)}>
              Ver cliente <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {lead.oportunidad_convertida_id && (
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/crm/oportunidades/${lead.oportunidad_convertida_id}`)}>
              Ver oportunidad <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border p-3">
            <Checkbox
              id="crear-cliente"
              checked={crearCliente}
              onCheckedChange={(c) => setCrearCliente(!!c)}
              disabled={!!lead.cliente_convertido_id}
            />
            <Label htmlFor="crear-cliente" className="text-sm font-normal cursor-pointer">
              Crear cliente "{lead.empresa}" en el directorio
            </Label>
          </div>

          <div className="space-y-1">
            <Label>Nombre de la oportunidad</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Monto estimado</Label>
              <Input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as typeof moneda)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Fecha estimada de cierre</Label>
            <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
          </div>
        </>
      )}
    </FormDialogShell>
  );
}
