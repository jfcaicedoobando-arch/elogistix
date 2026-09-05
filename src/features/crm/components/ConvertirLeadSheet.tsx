/**
 * ConvertirLeadSheet — Conversión Lead→Oportunidad sin perder contexto.
 *
 * Sheet lateral con 3 campos esenciales (nombre, monto, modo opcional).
 * Tras convertir, se queda en /crm/leads/:id y muestra toast con acción
 * "Abrir oportunidad →". Para campos avanzados, el caller puede abrir el
 * `ConvertirLeadDialog` clásico ("Más campos →").
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SelectorClienteExistente from "@/features/crm/components/SelectorClienteExistente";
import { SIN_CLIENTE } from "@/features/crm/constants/crmConstants";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useConvertirLead, type CrmLeadRow } from "@/features/crm/hooks";
import { formSheet } from "@/components/shared/utils/dialogTokens";
import type { Moneda } from "@/types/db";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CrmLeadRow;
  onAbrirAvanzado?: () => void;
}

export default function ConvertirLeadSheet({ open, onOpenChange, lead, onAbrirAvanzado }: Props) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(`Oportunidad — ${lead.empresa}`);
  const [monto, setMonto] = useState("0");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [clienteId, setClienteId] = useState<string>(lead.cliente_convertido_id ?? SIN_CLIENTE);
  const convertir = useConvertirLead();

  // Reinicia el borrador sólo cuando cambia el lead (evita convertir B con datos de A).
  const [leadIdBorrador, setLeadIdBorrador] = useState(lead.id);
  if (leadIdBorrador !== lead.id) {
    setLeadIdBorrador(lead.id);
    setClienteId(lead.cliente_convertido_id ?? SIN_CLIENTE);
    setNombre(`Oportunidad — ${lead.empresa}`);
    setMonto("0");
    setMoneda("MXN");
  }

  const yaConvertido = lead.estado === "Convertido" && lead.oportunidad_convertida_id;

  const handleConvertir = async () => {
    try {
      const r = await convertir.mutateAsync({
        lead,
        clienteIdExistente:
          lead.cliente_convertido_id ?? (clienteId === SIN_CLIENTE ? null : clienteId || null),
        nombreOportunidad: nombre.trim() || `Oportunidad — ${lead.empresa}`,
        montoEstimado: Number(monto) || 0,
        moneda,
        fechaEstimadaCierre: null,
        // El Sheet emite su propio aviso accionable ("Abrir oportunidad").
        silencioso: true,
      });
      onOpenChange(false);
      notifySuccess(undefined, {
        title: "Lead convertido",
        duration: 5000,
        action: r.oportunidadId
          ? { label: "Abrir oportunidad →", onClick: () => navigate(`/crm/oportunidades/${r.oportunidadId}`) }
          : undefined,
      });
    } catch {
      /* el hook `useConvertirLead` ya notificó el error */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={formSheet}>
        <SheetHeader>
          <SheetTitle>{yaConvertido ? "Lead convertido" : "Convertir lead"}</SheetTitle>
          <SheetDescription>
            {yaConvertido
              ? "Este lead ya fue convertido. Abre la oportunidad o el cliente generados."
              : "Genera la oportunidad inicial sin salir del lead."}
          </SheetDescription>
        </SheetHeader>

        {yaConvertido ? (
          <div className="space-y-3 py-4 text-body">
            {lead.oportunidad_convertida_id && (
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/crm/oportunidades/${lead.oportunidad_convertida_id}`)}>
                Ver oportunidad <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {lead.cliente_convertido_id && (
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/clientes/${lead.cliente_convertido_id}`)}>
                Ver cliente <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="nombre-op">Nombre de la oportunidad</Label>
              <Input id="nombre-op" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label htmlFor="monto-op">Monto estimado</Label>
                <Input id="monto-op" type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} />
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
            <SelectorClienteExistente
              id="convertir-cliente-existente-sheet"
              value={clienteId}
              onChange={setClienteId}
              disabled={!!lead.cliente_convertido_id}
            />
          </div>
        )}

        <SheetFooter className="flex-row justify-between sm:justify-between">
          {!yaConvertido && onAbrirAvanzado ? (
            <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); onAbrirAvanzado(); }}>
              Más campos →
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            {!yaConvertido && (
              <Button onClick={handleConvertir} loading={convertir.isPending}>
                Convertir
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
