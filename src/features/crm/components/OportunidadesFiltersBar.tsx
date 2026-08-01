/**
 * Filtros avanzados para Oportunidades (cliente-side sobre el dataset ya cargado).
 */
import { X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CrmEtapaRow } from "@/features/crm/hooks";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "./oportunidadesFiltersTypes";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";

interface Props {
  etapas: CrmEtapaRow[];
  vendedores: Array<{ id: string; email: string }>;
  value: OportunidadesFiltros;
  onChange: (next: OportunidadesFiltros) => void;
}

export default function OportunidadesFiltersBar({ etapas, vendedores, value, onChange }: Props) {
  const set = <K extends keyof OportunidadesFiltros>(k: K, v: OportunidadesFiltros[K]) =>
    onChange({ ...value, [k]: v });

  const isDirty =
    value.etapaId !== "todas" ||
    value.vendedorId !== "todos" ||
    value.cierreDesde !== "" ||
    value.cierreHasta !== "" ||
    value.montoMin !== "";

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
      <div className="space-y-1">
        <Label className="text-xs">Etapa</Label>
        <Select value={value.etapaId} onValueChange={(v) => set("etapaId", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Vendedor</Label>
        <Select value={value.vendedorId} onValueChange={(v) => set("vendedorId", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{rangoLabel("Cierre", "desde")}</Label>
        <DatePickerMx value={value.cierreDesde} onChange={(v) => set("cierreDesde", v)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{rangoLabel("Cierre", "hasta")}</Label>
        <DatePickerMx value={value.cierreHasta} onChange={(v) => set("cierreHasta", v)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Monto mínimo</Label>
        <Input
          type="number" min={0} inputMode="numeric"
          value={value.montoMin}
          onChange={(e) => set("montoMin", e.target.value)}
          placeholder="0"
        />
      </div>
      <div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onChange(FILTROS_DEFAULT)}
          disabled={!isDirty}
        >
          <X className="h-4 w-4 mr-1" /> Limpiar
        </Button>
      </div>
    </div>
  );
}
