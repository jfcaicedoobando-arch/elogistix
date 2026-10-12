/** Estado y snapshot de captura de la nota de crédito de proveedor. */
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type {
  MotivoNotaCreditoProveedor as MotivoNC,
  MonedaNotaCreditoProveedor as MonedaNC,
} from "@/features/cxp/types";
import type { CfdiParsedResponse } from "@/features/cxp/services";

interface CapturaNc {
  mode: "manual" | "cfdi";
  folio: string; fecha: string; monto: string; subtotal: string; tipoCambio: string; descripcion: string;
  moneda: MonedaNC; motivo: MotivoNC;
  parsedCfdi: CfdiParsedResponse | null; uuidFiscal: string | null;
  xml: File | null; pdf: File | null;
}
function capturaNcVacia(moneda: MonedaNC): CapturaNc {
  return {
    mode: "manual", folio: "", fecha: format(new Date(), "yyyy-MM-dd"), monto: "", subtotal: "",
    moneda, tipoCambio: "", motivo: "Bonificacion", descripcion: "",
    parsedCfdi: null, uuidFiscal: null, xml: null, pdf: null,
  };
}

export function useNotaCreditoProveedorCaptura(open: boolean, monedaFactura: MonedaNC) {
  const [capturaInicial, setCapturaInicial] = useState(() => capturaNcVacia(monedaFactura));
  const inicializadoRef = useRef(false);
  const [mode, setMode] = useState<"manual" | "cfdi">("manual");
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(capturaInicial.fecha);
  const [monto, setMonto] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [moneda, setMoneda] = useState<MonedaNC>(monedaFactura);
  const [tipoCambio, setTipoCambio] = useState(""); // MXN por 1 unidad extranjera
  const [motivo, setMotivo] = useState<MotivoNC>("Bonificacion");
  const [descripcion, setDescripcion] = useState("");
  const [parsedCfdi, setParsedCfdi] = useState<CfdiParsedResponse | null>(null);
  const [cfdiFiles, setCfdiFiles] = useState<{ xml: File | null; pdf: File | null }>({ xml: null, pdf: null });
  const [uuidFiscal, setUuidFiscal] = useState<string | null>(null);
  const capturaActual: CapturaNc = {
    mode, folio, fecha, monto, subtotal, moneda, tipoCambio, motivo, descripcion,
    parsedCfdi, uuidFiscal, xml: cfdiFiles.xml, pdf: cfdiFiles.pdf,
  };
  // Los objetos CFDI y File se comparan por referencia, sin serializarlos.
  // Antes de procesar, la selección local de XML/PDF queda protegida por mode="cfdi".
  const isDirty = Object.entries(capturaActual).some(
    ([campo, valor]) => !Object.is(valor, capturaInicial[campo as keyof CapturaNc]),
  );
  const reset = useCallback(() => {
    const inicial = capturaNcVacia(monedaFactura);
    setCapturaInicial(inicial);
    setMode("manual");
    setFolio("");
    setFecha(inicial.fecha);
    setMonto("");
    setSubtotal("");
    setMoneda(monedaFactura);
    setTipoCambio("");
    setMotivo("Bonificacion");
    setDescripcion("");
    setParsedCfdi(null);
    setCfdiFiles({ xml: null, pdf: null });
    setUuidFiscal(null);
  }, [monedaFactura]);
  useEffect(() => {
    if (!open) { inicializadoRef.current = false; return; }
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    reset();
  }, [open, reset]);

  return {
    mode, setMode, folio, setFolio, fecha, setFecha, monto, setMonto, subtotal, setSubtotal,
    moneda, setMoneda, tipoCambio, setTipoCambio, motivo, setMotivo, descripcion, setDescripcion,
    parsedCfdi, setParsedCfdi, cfdiFiles, setCfdiFiles, uuidFiscal, setUuidFiscal, isDirty, reset,
  };
}
