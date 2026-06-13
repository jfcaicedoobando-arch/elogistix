import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/shared";
import { useRegistrarActividad } from "@/hooks/shared";
import {
  useNotasCredito, useCrearNotaCredito, useCambiarEstadoNotaCredito,
  type EstadoNotaCredito,
} from "@/features/facturacion/hooks";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";
import { HistorialNotasCredito } from "./HistorialNotasCredito";
import type { Database } from "@/integrations/supabase/types";

type Motivo = Database["public"]["Enums"]["motivo_nota_credito"];
const MOTIVOS: Motivo[] = ["Descuento", "Error", "Devolucion", "Bonificacion", "Otro"];

interface FacturaParaNC {
  id: string;
  numero: string;
  total: number;
  saldo: number;
  moneda: string;
  tipo_cambio: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaParaNC | null;
  canApprove: boolean;
}


const today = () => new Date().toISOString().slice(0, 10);

export function DialogNotaCredito({ open, onOpenChange, factura, canApprove }: Props) {
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();
  const { data: notas = [], isLoading } = useNotasCredito(factura?.id);
  const crear = useCrearNotaCredito();
  const cambiar = useCambiarEstadoNotaCredito();

  const [folio, setFolio] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("Descuento");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(today());

  useEffect(() => {
    if (open && factura) {
      setFolio(`NC-${factura.numero}-${notas.length + 1}`);
      setMotivo("Descuento");
      setDescripcion("");
      setMonto(factura.saldo > 0 ? factura.saldo.toFixed(2) : "");
      setFecha(today());
    }
  }, [open, factura, notas.length]);

  if (!factura) return null;

  const montoNum = Number(monto) || 0;
  const invalido = montoNum <= 0 || montoNum > factura.saldo + 0.01 || !folio.trim();

  const handleCrear = async () => {
    try {
      await crear.mutateAsync({
        factura_id: factura.id,
        folio: folio.trim(),
        motivo,
        descripcion,
        monto: montoNum,
        moneda: factura.moneda as Database["public"]["Enums"]["moneda"],
        tipo_cambio: factura.tipo_cambio || 1,
        fecha_emision: fecha,
      });
      registrarActividad.mutate({
        accion: "crear", modulo: "facturas", entidad_id: factura.id,
        entidad_nombre: `NC ${folio} (${formatCurrency(montoNum, factura.moneda)}) factura ${factura.numero}`,
      });
      notifySuccess(toast, { title: "Nota de crédito creada (Borrador)" });
    } catch (err) {
      notifyError(toast, {
        title: "Error al crear nota de crédito", description: getErrorMessage(err),
        method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  const handleCambioEstado = async (
    id: string, estadoActual: EstadoNotaCredito, estadoNuevo: EstadoNotaCredito,
  ) => {
    try {
      await cambiar.mutateAsync({ id, facturaId: factura.id, estadoActual, estadoNuevo });
      notifySuccess(toast, { title: `Nota de crédito ${estadoNuevo.toLowerCase()}` });
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo cambiar el estado", description: getErrorMessage(err),
        method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize.lg, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Notas de crédito — Factura {factura.numero}</DialogTitle>
          <DialogDescription>
            Total: <strong>{formatCurrency(factura.total, factura.moneda)}</strong> · Saldo:{" "}
            <strong className={factura.saldo > 0 ? "text-warning" : "text-success"}>
              {formatCurrency(factura.saldo, factura.moneda)}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-3">
            <h4 className="text-sm font-semibold">Nueva nota de crédito</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nc-folio">Folio</Label>
                <Input id="nc-folio" value={folio} onChange={(e) => setFolio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-fecha">Fecha</Label>
                <Input id="nc-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-motivo">Motivo</Label>
                <Select value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
                  <SelectTrigger id="nc-motivo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-monto">Monto ({factura.moneda})</Label>
                <Input
                  id="nc-monto" type="number" step="0.01" min="0" max={factura.saldo}
                  value={monto} onChange={(e) => setMonto(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="nc-desc">Descripción</Label>
              <Textarea id="nc-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCrear} disabled={invalido || crear.isPending}>
                {crear.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Crear borrador
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Historial</h4>
            <HistorialNotasCredito
              notas={notas as Parameters<typeof HistorialNotasCredito>[0]["notas"]}
              isLoading={isLoading}
              canApprove={canApprove}
              isPending={cambiar.isPending}
              onCambiarEstado={handleCambioEstado}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
