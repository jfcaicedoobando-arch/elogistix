/**
 * Estado del formulario de subida al buzón CxP: dos ranuras (PDF + XML),
 * lectura automática del CFDI y detección del proveedor por RFC.
 *
 * v13.506.0 — El operador también marca a qué conceptos de costo del embarque
 * corresponde el documento (sugerencia para contabilidad).
 */
import { useCallback, useMemo, useState } from "react";
import { emparejarArchivosEntrantes, validarParejaEntrante } from "@/lib/domain/facturasEntrantes";
import { extraerCfdiXmlMetaDeArchivo, metaCfdiUtil, type CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services/duplicadoRfc";
import { notifyError } from "@/lib/ui/appFeedback";

export interface ProveedorDetectado {
  id: string;
  nombre: string;
}

/** Concepto de costo marcado por el operador, con su importe sugerido. */
export interface ConceptoSugeridoSeleccion {
  monto: number;
  moneda: string;
  concepto: string;
}

interface Args {
  organizationId: string;
}

export function useSubirEntranteForm({ organizationId }: Args) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [meta, setMeta] = useState<CfdiXmlMeta | null>(null);
  const [proveedor, setProveedor] = useState<ProveedorDetectado | null>(null);
  const [proveedorDetectado, setProveedorDetectado] = useState<ProveedorDetectado | null>(null);
  const [nota, setNota] = useState("");
  // v13.503.0 — Monto declarado por operaciones (se coteja contra lo costeado).
  const [montoDeclarado, setMontoDeclarado] = useState<number | null>(null);
  const [monedaDeclarada, setMonedaDeclarada] = useState("MXN");
  // v13.506.0 — Conceptos de costo que el operador dice que cubre el documento.
  const [conceptos, setConceptos] = useState<Record<string, ConceptoSugeridoSeleccion>>({});
  const [sinCostoCapturado, setSinCostoCapturado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leyendoXml, setLeyendoXml] = useState(false);

  const limpiar = useCallback(() => {
    setPdf(null);
    setXml(null);
    setMeta(null);
    setProveedor(null);
    setProveedorDetectado(null);
    setNota("");
    setMontoDeclarado(null);
    setMonedaDeclarada("MXN");
    setConceptos({});
    setSinCostoCapturado(false);
    setError(null);
  }, []);

  const procesarXml = useCallback(async (archivo: File) => {
    setLeyendoXml(true);
    try {
      const leido = await extraerCfdiXmlMetaDeArchivo(archivo);
      setMeta(leido);
      // Prellena el monto con el total del CFDI (el operador puede ajustarlo).
      if (leido.total != null && leido.total > 0) setMontoDeclarado(leido.total);
      if (leido.moneda) setMonedaDeclarada(leido.moneda);
      const encontrado = leido.rfcEmisor
        ? await findProveedorByRfcEnOrg(leido.rfcEmisor, organizationId)
        : null;
      setProveedorDetectado(encontrado);
      // Sugerencia: sólo prellena si el operador aún no eligió a mano.
      if (encontrado) setProveedor((actual) => actual ?? encontrado);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo leer el XML; puedes subirlo igual y contabilidad lo revisará.",
        error: e,
        method: "LEER_XML_ENTRANTE",
      });
      setMeta(null);
    } finally {
      setLeyendoXml(false);
    }
  }, [organizationId]);

  /** Acepta una selección múltiple y la acomoda en las dos ranuras. */
  const agregarArchivos = useCallback((archivos: readonly File[]) => {
    const pareja = emparejarArchivosEntrantes(archivos, { pdf, xml });
    setPdf(pareja.pdf);
    setXml(pareja.xml);
    setError(
      pareja.ignorados.length > 0
        ? "Sólo se usa un PDF y un XML por factura; los demás archivos se ignoraron."
        : validarParejaEntrante({ pdf: pareja.pdf, xml: pareja.xml }),
    );
    if (pareja.xml && pareja.xml !== xml) void procesarXml(pareja.xml);
  }, [pdf, xml, procesarXml]);

  const quitarPdf = useCallback(() => { setPdf(null); setError(null); }, []);
  const quitarXml = useCallback(() => {
    setXml(null);
    setMeta(null);
    setProveedorDetectado(null);
    setError(null);
  }, []);

  /** Al cambiar de proveedor los conceptos marcados ya no aplican. */
  const elegirProveedor = useCallback((sel: ProveedorDetectado | null) => {
    setProveedor(sel);
    setConceptos({});
  }, []);

  const toggleConcepto = useCallback(
    (c: { id: string; concepto: string; monto: number; moneda: string }, marcado: boolean) => {
      setConceptos((actual) => {
        const siguiente = { ...actual };
        if (marcado) {
          siguiente[c.id] = { monto: c.monto, moneda: c.moneda, concepto: c.concepto };
        } else {
          delete siguiente[c.id];
        }
        return siguiente;
      });
      if (marcado) setSinCostoCapturado(false);
    },
    [],
  );

  const setMontoConcepto = useCallback((conceptoId: string, monto: number) => {
    setConceptos((actual) => (
      actual[conceptoId] ? { ...actual, [conceptoId]: { ...actual[conceptoId], monto } } : actual
    ));
  }, []);

  const marcarSinCosto = useCallback((valor: boolean) => {
    setSinCostoCapturado(valor);
    if (valor) setConceptos({});
  }, []);

  const conceptosSeleccionados = useMemo(
    () => Object.entries(conceptos).map(([conceptoId, sel]) => ({ conceptoId, ...sel })),
    [conceptos],
  );
  /** Suma de lo marcado por moneda, para cotejar contra el monto declarado. */
  const sumaSugeridaPorMoneda = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const s of conceptosSeleccionados) {
      totales[s.moneda] = (totales[s.moneda] ?? 0) + s.monto;
    }
    return totales;
  }, [conceptosSeleccionados]);

  /**
   * v13.618.0 — Documentos sin XML (debit notes extranjeras) llegaban sin
   * importe; un clic copia la suma de los conceptos marcados en esa moneda.
   */
  const usarSumaSugerida = useCallback(() => {
    const suma = sumaSugeridaPorMoneda[monedaDeclarada];
    if (suma && suma > 0) setMontoDeclarado(Number(suma.toFixed(2)));
  }, [sumaSugeridaPorMoneda, monedaDeclarada]);

  const metaUtil = useMemo(() => (meta ? metaCfdiUtil(meta) : false), [meta]);
  // Exige proveedor: un documento sin dueño obliga a contabilidad a adivinar.
  // Exige además decir a qué costo corresponde (o declarar que no corresponde).
  // v13.618.0 — Sin importe el documento llega ciego a contabilidad: obligatorio.
  const listo = Boolean(
    (pdf || xml)
    && proveedor
    && montoDeclarado != null && montoDeclarado > 0
    && !leyendoXml
    && !validarParejaEntrante({ pdf, xml })
    && (conceptosSeleccionados.length > 0 || sinCostoCapturado),
  );

  return {
    pdf, xml, meta, metaUtil, proveedor, proveedorDetectado, nota, error, leyendoXml, listo,
    montoDeclarado, monedaDeclarada,
    conceptos, conceptosSeleccionados, sumaSugeridaPorMoneda, sinCostoCapturado,
    setProveedor: elegirProveedor, setNota, setError, setMontoDeclarado, setMonedaDeclarada,
    toggleConcepto, setMontoConcepto, marcarSinCosto, usarSumaSugerida,
    agregarArchivos, quitarPdf, quitarXml, limpiar,
  };
}
