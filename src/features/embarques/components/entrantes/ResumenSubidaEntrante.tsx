/**
 * v13.506.0 — Resumen compacto de lo que se enviará al buzón, para que el
 * operador confirme de un vistazo antes de subir el documento.
 */
import { formatCurrency } from "@/lib/formatters/numbers";

interface Props {
  proveedorNombre: string | null;
  monto: number | null;
  moneda: string;
  archivos: { pdf: boolean; xml: boolean };
  conceptosMarcados: number;
  sinCostoCapturado: boolean;
}

export function ResumenSubidaEntrante({
  proveedorNombre, monto, moneda, archivos, conceptosMarcados, sinCostoCapturado,
}: Props) {
  const partes: string[] = [];
  partes.push(proveedorNombre ?? "Sin proveedor");
  partes.push(monto != null ? formatCurrency(monto, moneda) : "Sin monto");
  if (conceptosMarcados > 0) {
    partes.push(`${conceptosMarcados} concepto${conceptosMarcados === 1 ? "" : "s"}`);
  } else if (sinCostoCapturado) {
    partes.push("Sin costo capturado");
  }
  const adjuntos = [archivos.pdf ? "PDF" : null, archivos.xml ? "XML" : null].filter(Boolean);
  partes.push(adjuntos.length > 0 ? adjuntos.join(" + ") : "Sin archivos");

  return (
    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {partes.join(" · ")}
    </p>
  );
}
