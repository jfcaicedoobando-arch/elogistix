/**
 * Barra de acciones de Conciliación bancaria (cuenta, estado, importar,
 * conciliar exactos y movimiento manual).
 *
 * Extraída de `TesoreriaConciliacion.tsx` para respetar el límite de 200
 * líneas por archivo (baseline de arquitectura). Sólo presentación.
 */
import type { ChangeEvent, RefObject } from "react";
import { Upload, Sparkles, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type EstadoFiltro = "Pendiente" | "Conciliado" | "Ignorado" | "todos";

interface CuentaOpcion {
  id: string;
  banco: string;
  alias: string;
  moneda: string;
}

interface Props {
  cuentas: CuentaOpcion[];
  cuentaId: string;
  onCuentaChange: (id: string) => void;
  estado: EstadoFiltro;
  onEstadoChange: (estado: EstadoFiltro) => void;
  pendientesCount: number;
  isAutoConciliando: boolean;
  onConciliarExactos: () => void;
  onAbrirManual: () => void;
  fileRef: RefObject<HTMLInputElement>;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  importando: boolean;
}

export function ConciliacionToolbar({
  cuentas, cuentaId, onCuentaChange, estado, onEstadoChange,
  pendientesCount, isAutoConciliando, onConciliarExactos, onAbrirManual,
  fileRef, onFile, importando,
}: Props) {
  return (
    <Card>
      <CardContent density="compact" className="flex flex-wrap gap-3 items-center">
        <Select value={cuentaId} onValueChange={onCuentaChange}>
          <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Selecciona cuenta..." /></SelectTrigger>
          <SelectContent>
            {cuentas.length === 0
              ? <SelectItem value="__sin" disabled>No hay cuentas activas</SelectItem>
              : cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco} · {c.alias} ({c.moneda})</SelectItem>)
            }
          </SelectContent>
        </Select>

        <Select value={estado} onValueChange={(v) => onEstadoChange(v as EstadoFiltro)} disabled={!cuentaId}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Pendiente">Pendientes</SelectItem>
            <SelectItem value="Conciliado">Conciliados</SelectItem>
            <SelectItem value="Ignorado">Ignorados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={onConciliarExactos}
          disabled={!cuentaId || isAutoConciliando || pendientesCount === 0}
        >
          <Sparkles className="h-4 w-4 mr-2 text-primary" />
          {isAutoConciliando ? "Conciliando..." : "Conciliar exactos"}
        </Button>

        <Button variant="outline" onClick={onAbrirManual} disabled={!cuentaId}>
          <Plus className="h-4 w-4 mr-2" /> Movimiento manual
        </Button>

        <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={onFile} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={!cuentaId || importando}>
          <Upload className="h-4 w-4 mr-2" />
          {importando ? "Importando..." : "Importar XLSX/CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
