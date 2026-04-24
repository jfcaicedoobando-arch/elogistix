import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCrearProforma, type ConceptoProforma, type MonedaProforma } from "@/hooks/useProformas";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { calcularIVA } from "@/lib/financialUtils";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<'conceptos_venta'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  embarqueId: string;
  expediente: string;
  clienteId: string | null;
  clienteNombre: string;
  conceptosVenta: ConceptoVenta[];
}

export function DialogGenerarProforma({
  open, onOpenChange, embarqueId, expediente, clienteId, clienteNombre, conceptosVenta,
}: Props) {
  const { toast } = useToast();
  const crear = useCrearProforma();
  const tasaIva = useTasaIVA();

  const [moneda, setMoneda] = useState<MonedaProforma>('USD');
  const [aplicarIva, setAplicarIva] = useState(false);
  const [notas, setNotas] = useState("");
  const [conceptos, setConceptos] = useState<ConceptoProforma[]>([]);

  // Autocargar conceptos del embarque al abrir
  useEffect(() => {
    if (open) {
      const monedaPredominante = conceptosVenta.length > 0
        ? (conceptosVenta[0].moneda as MonedaProforma)
        : 'USD';
      setMoneda(monedaPredominante);
      setAplicarIva(false);
      setNotas("");
      setConceptos(
        conceptosVenta
          .filter(c => c.moneda === monedaPredominante)
          .map(c => ({
            descripcion: c.descripcion,
            cantidad: Number(c.cantidad),
            precio_unitario: Number(c.precio_unitario),
            moneda: c.moneda as MonedaProforma,
            total: Number(c.total),
          }))
      );
    }
  }, [open, conceptosVenta]);

  // Recalcular total al cambiar cantidad/precio
  const updateConcepto = (idx: number, patch: Partial<ConceptoProforma>) => {
    setConceptos(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const merged = { ...c, ...patch };
      merged.total = merged.cantidad * merged.precio_unitario;
      return merged;
    }));
  };

  const addLinea = () => {
    setConceptos(prev => [...prev, { descripcion: "", cantidad: 1, precio_unitario: 0, moneda, total: 0 }]);
  };

  const removeLinea = (idx: number) => {
    setConceptos(prev => prev.filter((_, i) => i !== idx));
  };

  const totales = useMemo(() => {
    const subtotal = conceptos.reduce((s, c) => s + c.total, 0);
    const iva = aplicarIva ? calcularIVA(subtotal, tasaIva) : 0;
    return { subtotal, iva, total: subtotal + iva };
  }, [conceptos, aplicarIva, tasaIva]);

  const handleGuardar = () => {
    if (conceptos.length === 0) {
      toast({ title: "Agrega al menos un concepto", variant: "destructive" });
      return;
    }
    if (conceptos.some(c => !c.descripcion.trim())) {
      toast({ title: "Todos los conceptos requieren descripción", variant: "destructive" });
      return;
    }

    // Forzar moneda uniforme
    const conceptosNormalizados = conceptos.map(c => ({ ...c, moneda }));

    crear.mutate({
      embarque_id: embarqueId,
      expediente,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      conceptos: conceptosNormalizados,
      moneda,
      subtotal: totales.subtotal,
      iva: totales.iva,
      total: totales.total,
      notas,
    }, {
      onSuccess: () => {
        toast({ title: "Proforma generada correctamente" });
        onOpenChange(false);
      },
      onError: (e) => toast({ title: "Error al generar proforma", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Proforma — {expediente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaProforma)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Checkbox id="iva-pro" checked={aplicarIva} onCheckedChange={(v) => setAplicarIva(!!v)} />
              <Label htmlFor="iva-pro" className="cursor-pointer">Aplicar IVA ({(tasaIva * 100).toFixed(0)}%)</Label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Conceptos</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLinea}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-20">Cant.</TableHead>
                  <TableHead className="w-32">P. Unitario</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conceptos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                      Sin conceptos. Agrega líneas manualmente.
                    </TableCell>
                  </TableRow>
                )}
                {conceptos.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input value={c.descripcion} onChange={(e) => updateConcepto(idx, { descripcion: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} value={c.cantidad} onChange={(e) => updateConcepto(idx, { cantidad: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} step="0.01" value={c.precio_unitario} onChange={(e) => updateConcepto(idx, { precio_unitario: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(c.total, moneda)}
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeLinea(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>

          <div className="border rounded-md p-3 bg-muted/30 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{formatCurrency(totales.subtotal, moneda)}</span></div>
            {aplicarIva && (
              <div className="flex justify-between"><span>IVA</span><span className="font-medium">{formatCurrency(totales.iva, moneda)}</span></div>
            )}
            <div className="flex justify-between text-base pt-1 border-t"><span className="font-semibold">Total</span><span className="font-bold text-primary">{formatCurrency(totales.total, moneda)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={crear.isPending}>
            {crear.isPending ? "Guardando..." : "Generar Proforma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
