/**
 * Sub-bloque del Dialog "Capturar factura de proveedor": se muestra cuando NO
 * hay conceptos_costo pendientes para el proveedor. Permite:
 *   1. Ver embarques sugeridos automáticamente (RPC `sugerir_embarques_para_proveedor`).
 *   2. Buscar manualmente por expediente / BL / cliente.
 *   3. Seleccionar un embarque y crear un concepto_costo ad-hoc al guardar.
 *
 * El componente sólo NOTIFICA la selección al padre via `onSeleccionar`;
 * la creación del concepto se hace en `useNuevaFacturaProveedorForm` en el submit.
 */
import { useState } from "react";
import { Loader2, Search, Sparkles, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/shared";
import {
  useSugerirEmbarquesProveedor,
  useBuscarEmbarquesPorTexto,
  type EmbarqueSugerido,
} from "@/features/cxp/hooks";

import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { formatFechaEs } from "@/lib/formatters";



interface Props {
  proveedorId: string;
  proveedorNombre: string;
  organizationId: string | null;
  seleccionado: EmbarqueSeleccionado | null;
  onSeleccionar: (sel: EmbarqueSeleccionado | null) => void;
}

export function SugerirEmbarqueBlock({
  proveedorId, proveedorNombre, organizationId, seleccionado, onSeleccionar,
}: Props) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const sug = useSugerirEmbarquesProveedor(proveedorId, organizationId);
  const search = useBuscarEmbarquesPorTexto(debounced, organizationId, term.length >= 2);

  const lista = term.length >= 2 ? (search.data ?? []) : (sug.data ?? []);
  const loading = term.length >= 2 ? search.isLoading : sug.isLoading;

  const handlePick = (e: EmbarqueSugerido) => {
    onSeleccionar({
      embarqueId: e.embarque_id,
      expediente: e.expediente ?? e.embarque_id.slice(0, 8),
      concepto: `Servicios ${proveedorNombre}`.slice(0, 200),
    });
  };

  if (seleccionado) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="font-medium">Se creará un costo en el embarque</span>
          <Badge variant="outline" className="font-mono">{seleccionado.expediente}</Badge>
          <Button variant="ghost" size="sm" className="ml-auto h-7"
            onClick={() => onSeleccionar(null)}>
            Cambiar
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descripción del concepto a crear</Label>
          <Input
            value={seleccionado.concepto}
            onChange={(e) => onSeleccionar({ ...seleccionado, concepto: e.target.value })}
            placeholder="Ej. Flete marítimo, Maniobras, Demoras…"
          />
          <p className="text-xs text-muted-foreground">
            Se registrará por el total de la factura y quedará marcado como pagado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <Label className="text-sm font-semibold">
          Este proveedor no tiene costos pre-cargados
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Liga la factura a un embarque y crearemos el costo directo del embarque automáticamente.
      </p>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por expediente, BL o cliente…"
          className="pl-8 h-9"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando embarques…
        </div>
      )}

      {!loading && lista.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {term.length >= 2
            ? "No encontramos embarques con ese texto. Los embarques cerrados o cancelados no se muestran."
            : "No hay sugerencias automáticas. Busca por expediente o BL (no se muestran embarques cerrados ni cancelados)."}
        </p>
      )}

      {!loading && lista.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {term.length < 2 && (
            <p className="text-xs font-medium text-muted-foreground">
              Sugeridos para {proveedorNombre}:
            </p>
          )}
          {lista.map((e) => (
            <button
              key={e.embarque_id}
              type="button"
              onClick={() => handlePick(e)}
              className="w-full text-left rounded-md border bg-background px-3 py-2 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono font-medium">{e.expediente ?? "—"}</span>
                <span className="text-muted-foreground truncate">· {e.cliente_nombre ?? "Sin cliente"}</span>
                {e.estado && <Badge variant="secondary" className="ml-auto text-xs">{e.estado}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span className="text-accent">{e.match_tipo}</span>
                {e.eta && <span>· ETA {formatFechaEs(e.eta)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
