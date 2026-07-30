/**
 * Banner de contexto cuando la factura se captura desde el buzón CxP.
 * v13.366.0 — Muestra el documento origen y el avance de la precarga.
 */
import { FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EstadoAutocarga } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { EntranteParaCaptura } from "@/features/cxp/types";

interface Props {
  entrante: EntranteParaCaptura | null;
  estado: EstadoAutocarga;
  mensaje: string | null;
}

const TEXTOS: Record<EstadoAutocarga, string> = {
  idle: "Preparando la lectura del documento…",
  cargando: "Leyendo el documento y prellenando el formulario…",
  listo: "Datos precargados del documento. Verifica antes de guardar.",
  error: "No se pudo leer el documento: captura los datos a mano.",
};

export function EntranteCapturaBanner({ entrante, estado, mensaje }: Props) {
  if (!entrante) return null;
  return (
    <div className="rounded-md border border-info/40 bg-info/5 p-3">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{entrante.nombreArchivo}</span>
            <Badge variant="outline" size="xs">
              {entrante.expediente ?? "Sin expediente"}
            </Badge>
            {!entrante.xmlPath && <Badge variant="warning" size="xs">Sin XML</Badge>}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {estado === "cargando" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {estado === "listo" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            {estado === "error" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
            {mensaje ?? TEXTOS[estado]}
          </p>
        </div>
      </div>
    </div>
  );
}
