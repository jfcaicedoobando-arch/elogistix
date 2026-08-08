/**
 * Buscador de embarque para ligar un anticipo a un expediente.
 * Reutiliza la búsqueda por texto ya usada al capturar facturas de proveedor
 * (`useBuscarEmbarquesPorTexto`), sin sugerencias automáticas: aquí el
 * operador sabe de qué expediente es el dinero adelantado.
 */
import { useState } from "react";
import { Loader2, Search, X, Ship } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useBuscarEmbarquesPorTexto } from "@/features/cxp/hooks";

interface Props {
  /** Embarque seleccionado (id) o null. */
  value: string | null;
  /** Expediente del embarque seleccionado, para mostrarlo sin re-consultar. */
  expediente: string | null;
  onChange: (embarqueId: string | null, expediente: string | null) => void;
}

export function EmbarqueAnticipoPicker({ value, expediente, onChange }: Props) {
  const { organizationId } = useAuth();
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const search = useBuscarEmbarquesPorTexto(debounced, organizationId, term.trim().length >= 2);
  const lista = search.data ?? [];

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
        <Ship className="h-4 w-4 text-success" />
        <span className="text-sm">Ligado al expediente</span>
        <Badge variant="outline" className="font-mono">{expediente ?? value.slice(0, 8)}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7"
          onClick={() => { onChange(null, null); setTerm(""); }}
        >
          <X className="mr-1 h-3.5 w-3.5" /> Quitar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por expediente, BL o cliente…"
          className="h-9 pl-8"
          aria-label="Buscar embarque para el anticipo"
        />
      </div>

      {search.isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando embarques…
        </div>
      )}

      {!search.isLoading && term.trim().length >= 2 && lista.length === 0 && (
        <p className="text-xs italic text-muted-foreground">
          No encontramos embarques con ese texto (los cerrados y cancelados no se muestran).
        </p>
      )}

      {lista.length > 0 && (
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {lista.map((e) => (
            <button
              key={e.embarque_id}
              type="button"
              onClick={() => onChange(e.embarque_id, e.expediente ?? null)}
              className="w-full rounded-md border bg-background px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent/5"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono font-medium">{e.expediente ?? "—"}</span>
                <span className="truncate text-muted-foreground">· {e.cliente_nombre ?? "Sin cliente"}</span>
                {e.estado && <Badge variant="secondary" className="ml-auto text-xs">{e.estado}</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
