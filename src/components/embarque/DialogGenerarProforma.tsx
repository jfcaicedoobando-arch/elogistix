import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useCrearProforma } from "@/hooks/embarque/useProformas";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { fetchClienteParaPdf, fetchDiasCreditoCliente } from "@/services/proformaServices";
import { PasoSeleccionConceptos } from "./proforma/PasoSeleccionConceptos";
import { PasoConfirmacionProforma } from "./proforma/PasoConfirmacionProforma";
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
        tasaIva,
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
          <PasoSeleccionConceptos
            conceptosPendientes={conceptosPendientes}
            seleccionados={seleccionados}
            ivaPorConcepto={ivaPorConcepto}
            totales={totales}
            tasaIva={tasaIva}
            notas={notas}
            diasCredito={diasCredito}
            operadorEmbarque={embarque.operador}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onToggleIva={toggleIva}
            onNotasChange={setNotas}
            onDiasCreditoChange={setDiasCredito}
          />
        )}

        {paso === 'confirmacion' && (
          <PasoConfirmacionProforma
            conceptosSeleccionados={conceptosSeleccionados}
            ivaPorConcepto={ivaPorConcepto}
            totales={totales}
            tasaIva={tasaIva}
            notas={notas}
            diasCredito={diasCredito}
            operadorEmbarque={embarque.operador}
          />
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
