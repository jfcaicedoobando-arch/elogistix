/**
 * Diálogo para convertir un Lead en (opcional) Cliente + Oportunidad (CRM Fase 2).
 * Si el lead ya está convertido, muestra los IDs resultantes en lugar del form.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import SelectorClienteExistente from "@/features/crm/components/SelectorClienteExistente";
import { SIN_CLIENTE } from "@/features/crm/constants/crmConstants";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useConvertirLead, type CrmLeadRow } from "@/features/crm/hooks";
import type { Moneda } from "@/types/db";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CrmLeadRow;
}

export default function ConvertirLeadDialog({ open, onOpenChange, lead }: Props) {
  const [clienteId, setClienteId] = useState<string>(lead.cliente_convertido_id ?? SIN_CLIENTE);
  const [nombre, setNombre] = useState(`Oportunidad — ${lead.empresa}`);
  const [monto, setMonto] = useState<string>("0");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [fecha, setFecha] = useState<string>("");
  const convertir = useConvertirLead();
  const navigate = useNavigate();

  // Reinicia el borrador sólo cuando cambia el lead (evita convertir B con datos de A).
  useEffect(() => {
    setClienteId(lead.cliente_convertido_id ?? SIN_CLIENTE);
    setNombre(`Oportunidad — ${lead.empresa}`);
    setMonto("0");
    setMoneda("MXN");
    setFecha("");
  }, [lead.id, lead.empresa, lead.cliente_convertido_id]);

  const yaConvertido = lead.estado === "Convertido" && lead.oportunidad_convertida_id;

  const handle = async () => {
    try {
      const r = await convertir.mutateAsync({
        lead,
        clienteIdExistente:
          lead.cliente_convertido_id ?? (clienteId === SIN_CLIENTE ? null : clienteId || null),
        nombreOportunidad: nombre.trim() || `Oportunidad — ${lead.empresa}`,
        montoEstimado: Number(monto) || 0,
        moneda,
        fechaEstimadaCierre: fecha || null,
      });
      onOpenChange(false);
      if (r.clienteId) navigate(`/clientes/${r.clienteId}`);
    } catch {
      /* notificado por el hook `useConvertirLead` */
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
      {!yaConvertido && (
        <Button onClick={handle} loading={convertir.isPending}>
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
        <div className="space-y-3 text-body">
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
          <SelectorClienteExistente
            value={clienteId}
            onChange={setClienteId}
            disabled={!!lead.cliente_convertido_id}
          />

          <div className="space-y-1">
            <Label htmlFor="convertir-nombre-oportunidad">Nombre de la oportunidad</Label>
            <Input id="convertir-nombre-oportunidad" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label htmlFor="convertir-monto-estimado">Monto estimado</Label>
              <Input
                id="convertir-monto-estimado"
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
