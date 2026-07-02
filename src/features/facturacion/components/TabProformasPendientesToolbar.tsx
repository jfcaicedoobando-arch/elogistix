import { Layers, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import SearchInput from "@/components/shared/SearchInput";
import { formatCurrency, toTitleCase } from "@/lib/formatters";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  filtroCliente: string;
  setFiltroCliente: (v: string) => void;
  clientesDisponibles: string[];
  filtroAntiguedad: string;
  setFiltroAntiguedad: (v: "todos" | "7" | "15" | "30") => void;
  totalSeleccionadas: number;
  totalesSeleccion: { usd: number; mxn: number };
  puedeConsolidar: boolean;
  isConsolidarPending: boolean;
  handleConsolidar: () => void;
  puedeAprobar: boolean;
  isAprobarPending: boolean;
  handleAprobar: () => void;
  embarquesEnSeleccion: number;
}

export function TabProformasPendientesToolbar(p: Props) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap gap-3 items-center">
        <SearchInput
          value={p.search}
          onChange={p.setSearch}
          placeholder="Buscar por expediente, BL, cliente o número..."
          className="flex-1 min-w-[260px]"
        />
        <Select value={p.filtroCliente} onValueChange={p.setFiltroCliente}>
          <SelectTrigger className="w-[200px]" aria-label="Filtrar por cliente">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los clientes</SelectItem>
            {p.clientesDisponibles.map((cli) => (
              <SelectItem key={cli} value={cli}>{toTitleCase(cli)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={p.filtroAntiguedad}
          onValueChange={(v) => p.setFiltroAntiguedad(v as "todos" | "7" | "15" | "30")}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por antigüedad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Cualquier antigüedad</SelectItem>
            <SelectItem value="7">Más de 7 días</SelectItem>
            <SelectItem value="15">Más de 15 días</SelectItem>
            <SelectItem value="30">Más de 30 días</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col items-end text-right text-xs leading-tight min-w-[160px]">
          <span className="text-muted-foreground">
            {p.totalSeleccionadas} seleccionada{p.totalSeleccionadas === 1 ? '' : 's'}
          </span>
          {p.totalesSeleccion.usd > 0 && (
            <span className="font-medium">{formatCurrency(p.totalesSeleccion.usd, 'USD')}</span>
          )}
          {p.totalesSeleccion.mxn > 0 && (
            <span className="font-medium">{formatCurrency(p.totalesSeleccion.mxn, 'MXN')}</span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              disabled={!p.puedeConsolidar || p.isConsolidarPending}
              onClick={p.handleConsolidar}
            >
              <Layers className="h-4 w-4 mr-2" /> Consolidar y aprobar
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-semibold mb-1">Fusiona proformas del mismo embarque</p>
            <p className="text-muted-foreground">
              Une todas las proformas seleccionadas de un solo embarque en una sola proforma consolidada y la aprueba.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <strong>Ejemplo:</strong> seleccionas 3 proformas del embarque EXP-00125 (3 contenedores distintos). El sistema las une en una sola proforma con importe acumulado y la aprueba.
            </p>
            {p.embarquesEnSeleccion > 1 && (
              <p className="mt-2 text-xs text-destructive">
                Solo puedes consolidar proformas del mismo embarque.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              disabled={!p.puedeAprobar || p.isAprobarPending}
              onClick={p.handleAprobar}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar individual
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-semibold mb-1">Aprueba cada proforma por separado</p>
            <p className="text-muted-foreground">
              Cada proforma seleccionada se aprueba de forma independiente, sin fusionar. Útil cuando las proformas pertenecen a embarques distintos o el cliente requiere una factura por contenedor.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <strong>Ejemplo:</strong> seleccionas 2 proformas del embarque EXP-00125 y 1 del EXP-00098. Cada una se aprueba por separado y genera su propia factura al timbrar.
            </p>
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
