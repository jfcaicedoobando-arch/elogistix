/**
 * v13.508.0 — Estado del formulario de corrección de un documento del buzón.
 *
 * Arranca con lo que operaciones declaró al subir el archivo y permite
 * cambiarlo sin volver a subir el PDF/XML.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConceptoSugeridoSeleccion } from "@/features/cxp/hooks/useSubirEntranteForm";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import type { ConceptoCostoEmbarque } from "@/features/embarques/services";

interface ProveedorSel {
  id: string;
  nombre: string;
}

type Seleccion = Record<string, ConceptoSugeridoSeleccion>;

function seleccionInicial(row: FacturaEntranteRow | null): Seleccion {
  const filas = row?.embarque_facturas_entrantes_conceptos ?? [];
  const inicial: Seleccion = {};
  for (const f of filas) {
    inicial[f.concepto_costo_id] = {
      monto: Number(f.monto_sugerido ?? 0),
      moneda: f.conceptos_costo?.moneda ?? "MXN",
      concepto: f.conceptos_costo?.concepto ?? "Concepto de costo",
    };
  }
  return inicial;
}

export function useCorregirEntranteForm(row: FacturaEntranteRow | null) {
  const [proveedor, setProveedor] = useState<ProveedorSel | null>(null);
  const [montoDeclarado, setMontoDeclarado] = useState<number | null>(null);
  const [monedaDeclarada, setMonedaDeclarada] = useState("MXN");
  const [nota, setNota] = useState("");
  const [sinCostoCapturado, setSinCostoCapturado] = useState(false);
  const [conceptos, setConceptos] = useState<Seleccion>({});

  // Cada vez que cambia el documento se reinicia con sus datos declarados.
  useEffect(() => {
    setProveedor(
      row?.proveedor_id
        ? { id: row.proveedor_id, nombre: row.proveedores?.nombre ?? "Proveedor" }
        : null,
    );
    setMontoDeclarado(row?.monto_declarado != null ? Number(row.monto_declarado) : null);
    setMonedaDeclarada(row?.moneda_declarada ?? "MXN");
    setNota(row?.nota ?? "");
    setSinCostoCapturado(Boolean(row?.sin_costo_capturado));
    setConceptos(seleccionInicial(row));
  }, [row]);

  const elegirProveedor = useCallback((sel: ProveedorSel | null) => {
    setProveedor((actual) => {
      if (actual?.id !== sel?.id) setConceptos({});
      return sel;
    });
  }, []);

  const toggleConcepto = useCallback((c: ConceptoCostoEmbarque, marcado: boolean) => {
    setConceptos((actual) => {
      const siguiente = { ...actual };
      if (marcado) siguiente[c.id] = { monto: c.monto, moneda: c.moneda, concepto: c.concepto };
      else delete siguiente[c.id];
      return siguiente;
    });
    if (marcado) setSinCostoCapturado(false);
  }, []);

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

  const listo = Boolean(proveedor && (conceptosSeleccionados.length > 0 || sinCostoCapturado));

  return {
    proveedor, montoDeclarado, monedaDeclarada, nota, sinCostoCapturado,
    conceptos, conceptosSeleccionados, listo,
    setProveedor: elegirProveedor, setMontoDeclarado, setMonedaDeclarada, setNota,
    toggleConcepto, setMontoConcepto, marcarSinCosto,
  };
}
