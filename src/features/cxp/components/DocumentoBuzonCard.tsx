/**
 * v13.507.0 — Tarjeta del documento que viene del buzón CxP.
 *
 * Reemplaza al selector de origen y a la zona de carga cuando la captura nace
 * de un documento que operaciones ya subió: aquí no se sube nada, se verifica.
 */
import { FileText, FileCode2, Loader2, CheckCircle2, AlertTriangle, Ship, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters/dates";
import type { EstadoAutocarga } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { EntranteParaCaptura } from "@/features/cxp/types";

interface Props {
  entrante: EntranteParaCaptura;
  estado: EstadoAutocarga;
  mensaje: string | null;
  onVerArchivo: (path: string, nombre: string) => void;
  /** Vuelve a leer el documento del buzón (visible sólo en estado error). */
  onReintentar?: () => void;
}

const TEXTOS: Record<EstadoAutocarga, string> = {
  idle: "Preparando la lectura del documento…",
  cargando: "Leyendo el documento y prellenando el formulario…",
  listo: "Datos precargados del documento. Verifica antes de guardar.",
  error: "No se pudo leer el documento: captura los datos a mano.",
};

function EstadoLectura({ estado, mensaje }: { estado: EstadoAutocarga; mensaje: string | null }) {
  return (
    <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground" aria-live="polite">
      {estado === "cargando" && <Loader2 className="h-4 w-4 animate-spin" />}
      {estado === "listo" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
      {estado === "error" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
      {mensaje ?? TEXTOS[estado]}
    </p>
  );
}

export function DocumentoBuzonCard({ entrante, estado, mensaje, onVerArchivo, onReintentar }: Props) {
  const tienePdf = entrante.archivoPath.toLowerCase().endsWith(".pdf");

  return (
    <section className="rounded-md border border-info/40 bg-info/5 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-info" aria-hidden />
            <span className="truncate text-body font-semibold">{entrante.nombreArchivo}</span>
            <Badge variant="outline" size="xs">
              <Ship className="mr-1 h-3 w-3" aria-hidden />
              {entrante.expediente ?? "Sin expediente"}
            </Badge>
            {!entrante.xmlPath && <Badge variant="warning" size="xs">Sin XML</Badge>}
          </div>
          <p className="text-body-sm text-muted-foreground">
            Documento del buzón · subido el{" "}
            {entrante.creadoEn ? formatDate(entrante.creadoEn) : "—"}
            {entrante.proveedorNombre ? ` · ${entrante.proveedorNombre}` : ""}
          </p>
          <EstadoLectura estado={estado} mensaje={mensaje} />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {estado === "error" && onReintentar && (
            <Button size="sm" variant="outline" onClick={onReintentar}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Reintentar lectura
            </Button>
          )}
          {estado === "cargando" && (
            <Button size="sm" variant="outline" loading disabled>
              Leyendo…
            </Button>
          )}
          {tienePdf && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVerArchivo(entrante.archivoPath, entrante.nombreArchivo)}
            >
              <FileText className="mr-2 h-4 w-4" /> Ver PDF
            </Button>
          )}
          {entrante.xmlPath && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onVerArchivo(entrante.xmlPath as string, entrante.xmlNombre ?? "cfdi.xml")
              }
            >
              <FileCode2 className="mr-2 h-4 w-4" /> Ver XML
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
