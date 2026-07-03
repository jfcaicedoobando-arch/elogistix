import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle } from "lucide-react";
import { nombreDesdeEmail } from "@/lib/formatters";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { EmbarquesPorEstadoBucket, EstadoUiKey } from "@/features/operaciones/hooks";
import { ESTADO_ICON } from "./desempenoVisuals";
import { EmbarqueEstadoListItem } from "./embarquesEstadoDialog/EmbarqueEstadoListItem";

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

  const items = useMemo(() => bucket?.items ?? [], [bucket?.items]);
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

  const footer = (
    <>
      <Button variant="outline" onClick={irAEmbarques}>Ver todos en Embarques</Button>
      <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Icon}
      title={
        <span className="flex items-center gap-2">
          <span>{nombreDesdeEmail(operador)}</span>
          <span className="text-muted-foreground font-normal">·</span>
          <span>{estado}</span>
        </span>
      }
      description="Consulta el historial de cambios de estado del embarque seleccionado."
      headerAside={<Badge variant="secondary" className="tabular-nums">{total}</Badge>}
      size="3xl"
      footer={footer}
    >
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

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {items.length === 0 ? "Sin embarques en este estado." : "No hay coincidencias."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((e) => (
            <EmbarqueEstadoListItem
              key={e.id}
              e={e}
              estado={estado}
              onNavigate={() => onOpenChange(false)}
            />
          ))}
        </ul>
      )}
    </FormDialogShell>
  );
}
