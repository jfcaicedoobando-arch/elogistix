import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, AlertTriangle } from "lucide-react";
import { formatDate, toTitleCase, nombreDesdeEmail } from "@/lib/formatters";
import type { EmbarquesPorEstadoBucket, EstadoUiKey } from "@/hooks/operaciones/useOperacionesData";
import { ESTADO_COLOR, ESTADO_ICON } from "./desempenoVisuals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operador: string;
  estado: EstadoUiKey;
  bucket: EmbarquesPorEstadoBucket | undefined;
}

export function EmbarquesEstadoDialog({ open, onOpenChange, operador, estado, bucket }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const Icon = ESTADO_ICON[estado];

  const items = bucket?.items ?? [];
  const total = bucket?.total ?? items.length;
  const truncated = bucket?.truncated ?? false;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (e) =>
        e.expediente.toLowerCase().includes(q) ||
        (e.clienteNombre ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const irAEmbarques = () => {
    const params = new URLSearchParams();
    params.set("operador", operador);
    params.set("estado", estado);
    navigate(`/embarques?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: ESTADO_COLOR[estado] }} />
            <span>{nombreDesdeEmail(operador)}</span>
            <span className="text-muted-foreground font-normal">·</span>
            <span style={{ color: ESTADO_COLOR[estado] }}>{estado}</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {total}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por expediente o cliente..."
            className="pl-9"
            autoFocus
          />
        </div>

        {truncated && (
          <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md p-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Mostrando los primeros {items.length} de {total}. Usa "Ver todos en Embarques" para la lista completa.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {items.length === 0 ? "Sin embarques en este estado." : "No hay coincidencias."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((e) => {
                const subtitulo: string[] = [];
                if (e.modo) subtitulo.push(e.modo);
                if (e.tipo) subtitulo.push(e.tipo);
                const ruta =
                  e.origen || e.destino
                    ? `${e.origen || "—"} → ${e.destino || "—"}`
                    : null;

                let extra: { label: string; tone: "warning" | "danger" | "info" | "muted" } | null = null;
                if (estado === "Llegada" && e.diasEnPuerto > 0) {
                  extra = {
                    label: `${e.diasEnPuerto} ${e.diasEnPuerto === 1 ? "día" : "días"} en puerto`,
                    tone: e.diasEnPuerto > 7 ? "danger" : "warning",
                  };
                } else if (estado === "En Tránsito" && e.diasParaEta !== null) {
                  if (e.diasParaEta < 0) {
                    extra = { label: `ETA vencido (${Math.abs(e.diasParaEta)} d)`, tone: "danger" };
                  } else if (e.diasParaEta === 0) {
                    extra = { label: "Llega hoy", tone: "info" };
                  } else {
                    extra = {
                      label: `${e.diasParaEta} ${e.diasParaEta === 1 ? "día" : "días"} para ETA`,
                      tone: e.diasParaEta <= 3 ? "warning" : "muted",
                    };
                  }
                }

                return (
                  <li key={e.id}>
                    <Link
                      to={`/embarques/${e.id}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{e.expediente}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {toTitleCase(e.clienteNombre || "Sin cliente")}
                          </span>
                          {subtitulo.length > 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {subtitulo.join(" · ")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          {ruta && <span className="truncate">{ruta}</span>}
                          {e.etd && <span>ETD {formatDate(e.etd)}</span>}
                          {e.eta && <span>ETA {formatDate(e.eta)}</span>}
                          {extra && (
                            <span
                              className={
                                extra.tone === "danger"
                                  ? "text-destructive font-medium"
                                  : extra.tone === "warning"
                                  ? "text-warning font-medium"
                                  : extra.tone === "info"
                                  ? "text-info font-medium"
                                  : ""
                              }
                            >
                              · {extra.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={irAEmbarques}>
            Ver todos en Embarques
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
