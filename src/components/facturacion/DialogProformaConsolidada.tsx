import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, ArrowLeft, ArrowRight, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useCrearProformaConsolidada } from "@/hooks/embarque/useProformas";
import { generarPdfProformaConsolidada, type ContenedorConConceptos } from "@/generators/proformaConsolidadaPdf";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ExpedienteConsolidado } from "@/hooks/embarque/useExpedientesConsolidados";

type ConceptoVenta = Tables<'conceptos_venta'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expediente: ExpedienteConsolidado | null;
}

type Paso = 'seleccion' | 'confirmacion';

interface EmbarqueConConceptos {
  embarqueId: string;
  expediente: string;
  contenedor: string | null;
  tipo_contenedor: string | null;
  conceptos: ConceptoVenta[];
}

export function DialogProformaConsolidada({ open, onOpenChange, expediente }: Props) {
  const tasaIva = useTasaIVA();
  const crearProforma = useCrearProformaConsolidada();
  const [paso, setPaso] = useState<Paso>('seleccion');
  const [loading, setLoading] = useState(false);
  const [grupos, setGrupos] = useState<EmbarqueConConceptos[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ivaPorConcepto, setIvaPorConcepto] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState("");
  const [diasCredito, setDiasCredito] = useState<string>("");

  // Cargar conceptos pendientes de todos los embarques del grupo
  useEffect(() => {
    if (!open || !expediente) return;
    setPaso('seleccion');
    setNotas("");
    setLoading(true);
    (async () => {
      const embarqueIds = expediente.embarques.map(e => e.id);
      const { data: conceptos } = await supabase
        .from('conceptos_venta')
        .select('*')
        .in('embarque_id', embarqueIds)
        .or('estado_facturacion.is.null,estado_facturacion.eq.pendiente');

      const mapaConceptos = new Map<string, ConceptoVenta[]>();
      (conceptos || []).forEach(c => {
        const arr = mapaConceptos.get(c.embarque_id) || [];
        arr.push(c);
        mapaConceptos.set(c.embarque_id, arr);
      });

      const gruposBuilt: EmbarqueConConceptos[] = expediente.embarques.map(e => ({
        embarqueId: e.id,
        expediente: e.expediente,
        contenedor: e.contenedor,
        tipo_contenedor: e.tipo_contenedor,
        conceptos: mapaConceptos.get(e.id) || [],
      }));
      setGrupos(gruposBuilt);

      // Seleccionar todos por defecto
      const allIds = new Set<string>();
      const ivaInit: Record<string, boolean> = {};
      gruposBuilt.forEach(g => g.conceptos.forEach(c => {
        allIds.add(c.id);
        ivaInit[c.id] = c.moneda === 'MXN' ? true : !!c.aplica_iva;
      }));
      setSeleccionados(allIds);
      setIvaPorConcepto(ivaInit);

      // Días de crédito del cliente
      if (expediente.cliente_id) {
        const { data: cli } = await supabase
          .from('clientes').select('dias_credito').eq('id', expediente.cliente_id).maybeSingle();
        setDiasCredito(cli?.dias_credito != null ? String(cli.dias_credito) : "");
      } else {
        setDiasCredito("");
      }

      setLoading(false);
    })();
  }, [open, expediente]);

  const toggle = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleIva = (id: string, moneda: string) => {
    if (moneda === 'MXN') return;
    setIvaPorConcepto(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const conceptosSeleccionados = useMemo(() => {
    const all: ConceptoVenta[] = [];
    grupos.forEach(g => g.conceptos.forEach(c => { if (seleccionados.has(c.id)) all.push(c); }));
    return all;
  }, [grupos, seleccionados]);

  const totales = useMemo(() => {
    const usd = conceptosSeleccionados.filter(c => c.moneda === 'USD');
    const mxn = conceptosSeleccionados.filter(c => c.moneda === 'MXN');
    const subtotal_usd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_usd = usd.reduce((s, c) => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      return ivaPorConcepto[c.id] ? s + calcularIVA(sub, tasaIva) : s;
    }, 0);
    const subtotal_mxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
    const iva_mxn = calcularIVA(subtotal_mxn, tasaIva);
    return {
      subtotal_usd, iva_usd, total_usd: subtotal_usd + iva_usd,
      subtotal_mxn, iva_mxn, total_mxn: subtotal_mxn + iva_mxn,
    };
  }, [conceptosSeleccionados, tasaIva, ivaPorConcepto]);

  const totalConceptos = grupos.reduce((s, g) => s + g.conceptos.length, 0);

  const handleConfirmar = async () => {
    if (!expediente) return;
    try {
      const ivaOverrides: Record<string, boolean> = {};
      conceptosSeleccionados.forEach(c => {
        ivaOverrides[c.id] = c.moneda === 'MXN' ? true : !!ivaPorConcepto[c.id];
      });
      const diasCreditoNum = diasCredito.trim() === '' ? null : Number(diasCredito);

      const proforma = await crearProforma.mutateAsync({
        embarquesIds: expediente.embarques.map(e => e.id),
        embarquePrincipalId: expediente.embarques[0].id,
        clienteId: expediente.cliente_id,
        clienteNombre: expediente.cliente_nombre,
        expediente: expediente.expediente,
        blMaster: expediente.bl_master,
        conceptoIds: Array.from(seleccionados),
        totales,
        notas: notas.trim() || undefined,
        operador: expediente.operador,
        diasCredito: Number.isFinite(diasCreditoNum as number) ? (diasCreditoNum as number) : null,
        ivaOverrides,
      });

      // Cargar cliente para PDF
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nombre, rfc, direccion, ciudad, estado, cp')
        .eq('id', expediente.cliente_id).maybeSingle();

      // Construir contenedores con sus conceptos seleccionados (con iva override aplicado)
      const contenedores: ContenedorConConceptos[] = grupos
        .map(g => ({
          embarque: {
            id: g.embarqueId,
            expediente: g.expediente,
            contenedor: g.contenedor,
            tipo_contenedor: g.tipo_contenedor,
          },
          conceptos: g.conceptos
            .filter(c => seleccionados.has(c.id))
            .map(c => ({ ...c, aplica_iva: ivaOverrides[c.id] })),
        }))
        .filter(c => c.conceptos.length > 0);

      generarPdfProformaConsolidada({
        proforma,
        blMaster: expediente.bl_master,
        contenedores,
        cliente,
        tasaIva,
      });
      onOpenChange(false);
    } catch {
      // manejado en hook
    }
  };

  if (!expediente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Proforma Consolidada
            <Badge variant="outline">{paso === 'seleccion' ? 'Paso 1 de 2' : 'Paso 2 de 2'}</Badge>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {expediente.contenedoresCount} contenedores
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Expediente <strong>{expediente.expediente}</strong>
            {expediente.bl_master ? <> · BL Master <strong>{expediente.bl_master}</strong></> : null}
            {' · '}Cliente <strong>{expediente.cliente_nombre}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paso === 'seleccion' ? (
          <div className="space-y-4">
            {totalConceptos === 0 && (
              <div className="rounded-md border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
                No hay conceptos pendientes de facturar en los embarques de este expediente.
              </div>
            )}

            <div className="space-y-3">
              {grupos.map(g => {
                if (g.conceptos.length === 0) return null;
                const titulo = g.contenedor
                  ? `${g.contenedor}${g.tipo_contenedor ? ` (${g.tipo_contenedor})` : ''}`
                  : `Embarque ${g.expediente}`;
                return (
                  <div key={g.embarqueId} className="border rounded-md overflow-hidden">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 border-b">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{titulo}</span>
                      <span className="text-xs text-muted-foreground">· {g.expediente}</span>
                    </div>
                    <div className="divide-y">
                      {g.conceptos.map(c => {
                        const sub = Number(c.cantidad) * Number(c.precio_unitario);
                        const isSel = seleccionados.has(c.id);
                        const ivaActivo = ivaPorConcepto[c.id] ?? false;
                        const ivaBloqueado = c.moneda === 'MXN';
                        return (
                          <div key={c.id} className="flex items-start gap-3 p-2.5 hover:bg-muted/20">
                            <Checkbox checked={isSel} onCheckedChange={() => toggle(c.id)} className="mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{c.descripcion}</span>
                                <Badge variant="outline" className="text-xs">{c.moneda}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {c.cantidad} × {formatCurrency(Number(c.precio_unitario), c.moneda)} = {formatCurrency(sub, c.moneda)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Label className="text-xs text-muted-foreground cursor-pointer">IVA</Label>
                              <Switch
                                checked={ivaActivo}
                                onCheckedChange={() => toggleIva(c.id, c.moneda)}
                                disabled={ivaBloqueado || !isSel}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <h4 className="font-semibold text-sm mb-2">Totales Consolidados</h4>
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
                  <div className="flex justify-between text-muted-foreground"><span>IVA MXN:</span><span>{formatCurrency(totales.iva_mxn, 'MXN')}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, 'MXN')}</span></div>
                </div>
              )}
              {seleccionados.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Selecciona al menos un concepto</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dias-credito-cons" className="text-sm">Días de crédito</Label>
                <Input
                  id="dias-credito-cons"
                  type="number"
                  min={0}
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  placeholder="0 = Contado"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Ejecutivo de Operaciones</Label>
                <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm">
                  {expediente.operador || <span className="text-muted-foreground italic">Sin asignar</span>}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notas-cons" className="text-sm">Notas (opcional)</Label>
              <Textarea
                id="notas-cons" value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas adicionales..." rows={2} className="mt-1"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-amber-50/50 border-amber-200 p-3 text-sm text-amber-900">
              <strong>Importante:</strong> Aún no se ha guardado nada. Revisa y confirma para generar la proforma consolidada.
            </div>

            <div className="space-y-3">
              {grupos.map(g => {
                const seleccionadosGrupo = g.conceptos.filter(c => seleccionados.has(c.id));
                if (seleccionadosGrupo.length === 0) return null;
                const titulo = g.contenedor
                  ? `${g.contenedor}${g.tipo_contenedor ? ` (${g.tipo_contenedor})` : ''}`
                  : g.expediente;
                return (
                  <div key={g.embarqueId} className="border rounded-md">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 border-b text-sm font-semibold">
                      <Package className="h-4 w-4 text-primary" /> {titulo}
                    </div>
                    <div className="divide-y text-sm">
                      {seleccionadosGrupo.map(c => {
                        const sub = Number(c.cantidad) * Number(c.precio_unitario);
                        return (
                          <div key={c.id} className="flex items-center justify-between px-3 py-1.5">
                            <span>{c.descripcion}</span>
                            <span className="font-medium">{formatCurrency(sub, c.moneda)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <h4 className="font-semibold text-sm mb-2">Totales finales</h4>
              {totales.subtotal_usd > 0 && (
                <>
                  <div className="flex justify-between text-sm"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, 'USD')}</span></div>
                  <div className="flex justify-between text-sm text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, 'USD')}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total USD:</span><span>{formatCurrency(totales.total_usd, 'USD')}</span></div>
                </>
              )}
              {totales.subtotal_mxn > 0 && (
                <div className={totales.subtotal_usd > 0 ? 'mt-3 pt-3 border-t' : ''}>
                  <div className="flex justify-between text-sm"><span>Subtotal MXN:</span><span>{formatCurrency(totales.subtotal_mxn, 'MXN')}</span></div>
                  <div className="flex justify-between text-sm text-muted-foreground"><span>IVA MXN:</span><span>{formatCurrency(totales.iva_mxn, 'MXN')}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, 'MXN')}</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {paso === 'seleccion' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => setPaso('confirmacion')} disabled={seleccionados.size === 0 || loading}>
                Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPaso('seleccion')} disabled={crearProforma.isPending}>
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
