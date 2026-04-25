import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useCrearProforma } from "@/hooks/embarque/useProformas";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { fetchClienteParaPdf, fetchDiasCreditoCliente } from "@/services/proformaServices";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  embarque: EmbarqueRow;
  conceptosPendientes: ConceptoVenta[];
}

type Paso = 'seleccion' | 'confirmacion';

export function DialogGenerarProforma({ open, onOpenChange, embarque, conceptosPendientes }: Props) {
  const tasaIva = useTasaIVA();
  const crearProforma = useCrearProforma();
  const [paso, setPaso] = useState<Paso>('seleccion');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ivaPorConcepto, setIvaPorConcepto] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState("");
  const [diasCredito, setDiasCredito] = useState<string>("");

  // Reset al abrir + cargar dias_credito del cliente como default
  useEffect(() => {
    if (open) {
      setPaso('seleccion');
      setSeleccionados(new Set(conceptosPendientes.map(c => c.id)));
      const ivaInit: Record<string, boolean> = {};
      conceptosPendientes.forEach(c => {
        ivaInit[c.id] = c.moneda === 'MXN' ? true : !!c.aplica_iva;
      });
      setIvaPorConcepto(ivaInit);
      setNotas("");
      setDiasCredito("");
      // Cargar dias_credito del cliente como default
      if (embarque.cliente_id) {
        fetchDiasCreditoCliente(embarque.cliente_id).then((dias) => {
          if (dias != null) setDiasCredito(String(dias));
        }).catch(() => { /* fallback silencioso */ });
      }
    }
  }, [open, conceptosPendientes, embarque.cliente_id]);

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

  const toggleIva = (id: string, moneda: string) => {
    if (moneda === 'MXN') return;
    setIvaPorConcepto(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const conceptosSeleccionados = useMemo(
    () => conceptosPendientes.filter(c => seleccionados.has(c.id)),
    [conceptosPendientes, seleccionados]
  );

  const totales = useMemo(() => {
    const usd = conceptosSeleccionados.filter(c => c.moneda === 'USD');
    const mxn = conceptosSeleccionados.filter(c => c.moneda === 'MXN');

    const subtotal_usd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_usd = usd.reduce((s, c) => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      return ivaPorConcepto[c.id] ? s + calcularIVA(sub, tasaIva) : s;
    }, 0);
    const total_usd = subtotal_usd + iva_usd;

    const subtotal_mxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);
    const total_mxn = subtotal_mxn + iva_mxn;

    return { subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn };
  }, [conceptosSeleccionados, tasaIva, ivaPorConcepto]);

  const handleConfirmar = async () => {
    try {
      const ivaOverrides: Record<string, boolean> = {};
      conceptosSeleccionados.forEach(c => {
        ivaOverrides[c.id] = c.moneda === 'MXN' ? true : !!ivaPorConcepto[c.id];
      });

      const diasCreditoNum = diasCredito.trim() === '' ? null : Number(diasCredito);
      const proforma = await crearProforma.mutateAsync({
        embarqueId: embarque.id,
        clienteId: embarque.cliente_id,
        clienteNombre: embarque.cliente_nombre,
        expediente: embarque.expediente,
        blMaster: embarque.bl_master,
        conceptoIds: Array.from(seleccionados),
        totales,
        notas: notas.trim() || undefined,
        operador: embarque.operador || null,
        diasCredito: Number.isFinite(diasCreditoNum as number) ? (diasCreditoNum as number) : null,
        ivaOverrides,
      });
      const cliente = await fetchClienteParaPdf(embarque.cliente_id);
      const conceptosParaPdf = conceptosSeleccionados.map(c => ({
        ...c,
        aplica_iva: ivaOverrides[c.id],
      }));
      generarPdfProforma({
        proforma,
        embarque,
        conceptos: conceptosParaPdf,
        cliente,
        tasaIva,
      });
      onOpenChange(false);
    } catch {
      // Error manejado en hook
    }
  };

  const totalSeleccionados = seleccionados.size;
  const allSelected = totalSeleccionados === conceptosPendientes.length && totalSeleccionados > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paso === 'seleccion' ? (
              <>Generar Proforma <Badge variant="outline">Paso 1 de 2</Badge></>
            ) : (
              <>Confirmar Proforma <Badge variant="outline">Paso 2 de 2</Badge></>
            )}
          </DialogTitle>
          <DialogDescription>
            {paso === 'seleccion'
              ? 'Selecciona los conceptos y decide si aplica IVA en cada uno (MXN siempre lleva IVA).'
              : 'Revisa el resumen final antes de confirmar. Aún no se ha generado nada.'}
          </DialogDescription>
        </DialogHeader>

        {paso === 'seleccion' && (
          <div className="space-y-4">
            <div className="border rounded-md">
              <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="all" />
                  <Label htmlFor="all" className="text-sm font-medium cursor-pointer">
                    Seleccionar todos ({totalSeleccionados}/{conceptosPendientes.length})
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground">IVA por concepto</span>
              </div>
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {conceptosPendientes.map(c => {
                  const sub = Number(c.cantidad) * Number(c.precio_unitario);
                  const isSelected = seleccionados.has(c.id);
                  const ivaActivo = ivaPorConcepto[c.id] ?? false;
                  const ivaBloqueado = c.moneda === 'MXN';
                  return (
                    <div key={c.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(c.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{c.descripcion}</span>
                          <Badge variant="outline" className="text-xs">{c.moneda}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.cantidad} × {formatCurrency(Number(c.precio_unitario), c.moneda)} = {formatCurrency(sub, c.moneda)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`iva-${c.id}`} className="text-xs text-muted-foreground cursor-pointer">
                            IVA
                          </Label>
                          <Switch
                            id={`iva-${c.id}`}
                            checked={ivaActivo}
                            onCheckedChange={() => toggleIva(c.id, c.moneda)}
                            disabled={ivaBloqueado || !isSelected}
                          />
                        </div>
                        {ivaBloqueado && (
                          <span className="text-[10px] text-muted-foreground">Obligatorio MXN</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dias-credito" className="text-sm">Días de crédito</Label>
                <Input
                  id="dias-credito"
                  type="number"
                  min={0}
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  placeholder="0 = Contado"
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Por defecto se toma del cliente. 0 = Contado.
                </p>
              </div>
              <div>
                <Label className="text-sm">Ejecutivo de Operaciones</Label>
                <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm">
                  {embarque.operador || <span className="text-muted-foreground italic">Sin asignar</span>}
                </div>
              </div>
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
        )}

        {paso === 'confirmacion' && (
          <div className="space-y-4">
            <div className="rounded-md border bg-amber-50/50 border-amber-200 p-3 text-sm">
              <p className="text-amber-900">
                <strong>Importante:</strong> Aún no se ha guardado nada. Revisa el resumen y confirma para generar la proforma y descargar el PDF.
              </p>
            </div>

            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b">
                <h4 className="text-sm font-semibold">Conceptos incluidos ({conceptosSeleccionados.length})</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">P. Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-center">IVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conceptosSeleccionados.map(c => {
                    const sub = Number(c.cantidad) * Number(c.precio_unitario);
                    const aplicaIva = c.moneda === 'MXN' ? true : !!ivaPorConcepto[c.id];
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.descripcion}</TableCell>
                        <TableCell className="text-right">{c.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(c.precio_unitario), c.moneda)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(sub, c.moneda)}</TableCell>
                        <TableCell>{c.moneda}</TableCell>
                        <TableCell className="text-center">
                          {aplicaIva ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Sí
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Ejecutivo de Operaciones</p>
                <p className="font-semibold mt-0.5">{embarque.operador || '—'}</p>
              </div>
              <div className="rounded-md border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Días de crédito</p>
                <p className="font-semibold mt-0.5">
                  {diasCredito.trim() === '' ? '—' : Number(diasCredito) === 0 ? 'Contado' : `${diasCredito} días`}
                </p>
              </div>
            </div>

            <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <h4 className="font-semibold text-sm mb-2">Totales finales</h4>
              {totales.subtotal_usd > 0 && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, 'USD')}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, 'USD')}</span></div>
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
            </div>

            {notas.trim() && (
              <div className="rounded-md border p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Notas:</p>
                <p className="text-sm whitespace-pre-wrap">{notas}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {paso === 'seleccion' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => setPaso('confirmacion')}
                disabled={totalSeleccionados === 0}
              >
                Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setPaso('seleccion')}
                disabled={crearProforma.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver
              </Button>
              <Button onClick={handleConfirmar} disabled={crearProforma.isPending}>
                {crearProforma.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" /> Confirmar y Generar</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
