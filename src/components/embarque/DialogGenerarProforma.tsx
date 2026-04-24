import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useCrearProforma } from "@/hooks/embarque/useProformas";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  embarque: EmbarqueRow;
  conceptosPendientes: ConceptoVenta[];
}

export function DialogGenerarProforma({ open, onOpenChange, embarque, conceptosPendientes }: Props) {
  const tasaIva = useTasaIVA();
  const crearProforma = useCrearProforma();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [notas, setNotas] = useState("");

  // Reset al abrir: seleccionar todos por defecto
  useEffect(() => {
    if (open) {
      setSeleccionados(new Set(conceptosPendientes.map(c => c.id)));
      setNotas("");
    }
  }, [open, conceptosPendientes]);

  const toggle = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (seleccionados.size === conceptosPendientes.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(conceptosPendientes.map(c => c.id)));
    }
  };

  const conceptosSeleccionados = useMemo(
    () => conceptosPendientes.filter(c => seleccionados.has(c.id)),
    [conceptosPendientes, seleccionados]
  );

  // Calcular totales por moneda
  const totales = useMemo(() => {
    const usd = conceptosSeleccionados.filter(c => c.moneda === 'USD');
    const mxn = conceptosSeleccionados.filter(c => c.moneda === 'MXN');

    const subtotal_usd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_usd = usd.reduce((s, c) => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      return c.aplica_iva ? s + calcularIVA(sub, tasaIva) : s;
    }, 0);
    const total_usd = subtotal_usd + iva_usd;

    const subtotal_mxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);
    const total_mxn = subtotal_mxn + iva_mxn;

    return { subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn };
  }, [conceptosSeleccionados, tasaIva]);

  const handleGenerar = async () => {
    try {
      const proforma = await crearProforma.mutateAsync({
        embarqueId: embarque.id,
        clienteId: embarque.cliente_id,
        clienteNombre: embarque.cliente_nombre,
        expediente: embarque.expediente,
        blMaster: embarque.bl_master,
        conceptoIds: Array.from(seleccionados),
        totales,
        notas: notas.trim() || undefined,
      });
      // Cargar datos del cliente para el PDF
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nombre, rfc, direccion, ciudad, estado, cp')
        .eq('id', embarque.cliente_id)
        .maybeSingle();
      // Generar y descargar PDF
      generarPdfProforma({
        proforma,
        embarque,
        conceptos: conceptosSeleccionados,
        cliente,
        tasaIva,
      });
      onOpenChange(false);
    } catch {
      // Error ya manejado en el hook
    }
  };

  const totalSeleccionados = seleccionados.size;
  const allSelected = totalSeleccionados === conceptosPendientes.length && totalSeleccionados > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Proforma</DialogTitle>
          <DialogDescription>
            Selecciona los conceptos a incluir en la proforma. Se generará un número consecutivo y se descargará el PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-md">
            <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="all" />
                <Label htmlFor="all" className="text-sm font-medium cursor-pointer">
                  Seleccionar todos ({totalSeleccionados}/{conceptosPendientes.length})
                </Label>
              </div>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {conceptosPendientes.map(c => {
                const sub = Number(c.cantidad) * Number(c.precio_unitario);
                const aplicaIva = c.moneda === 'MXN' || c.aplica_iva;
                return (
                  <div key={c.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                    <Checkbox
                      checked={seleccionados.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.descripcion}</span>
                        <Badge variant="outline" className="text-xs">{c.moneda}</Badge>
                        {aplicaIva && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">+IVA</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.cantidad} × {formatCurrency(Number(c.precio_unitario), c.moneda)} = {formatCurrency(sub, c.moneda)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen totales */}
          <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <h4 className="font-semibold text-sm mb-2">Totales de la Proforma</h4>
            {totales.subtotal_usd > 0 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, 'USD')}</span></div>
                {totales.iva_usd > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, 'USD')}</span></div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total USD:</span><span>{formatCurrency(totales.total_usd, 'USD')}</span></div>
              </div>
            )}
            {totales.subtotal_mxn > 0 && (
              <div className={`space-y-1 text-sm ${totales.subtotal_usd > 0 ? 'mt-3 pt-3 border-t' : ''}`}>
                <div className="flex justify-between"><span>Subtotal MXN:</span><span>{formatCurrency(totales.subtotal_mxn, 'MXN')}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>IVA ({(tasaIva * 100).toFixed(0)}%) MXN:</span><span>{formatCurrency(totales.iva_mxn, 'MXN')}</span></div>
                <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, 'MXN')}</span></div>
              </div>
            )}
            {totalSeleccionados === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Selecciona al menos un concepto</p>
            )}
          </div>

          <div>
            <Label htmlFor="notas" className="text-sm">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales para esta proforma..."
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={crearProforma.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerar}
            disabled={totalSeleccionados === 0 || crearProforma.isPending}
          >
            {crearProforma.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
            ) : (
              <><FileText className="h-4 w-4 mr-2" /> Generar Proforma</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
