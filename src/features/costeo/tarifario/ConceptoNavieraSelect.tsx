/** Lista de conceptos de cargo local de naviera, con opción para agregar uno nuevo. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CONCEPTOS_NAVIERA_BASE = ["Revalidación", "ISPS", "Garantía"] as const;

export function opcionesConcepto(extra: string[], actual: string): string[] {
  const todas = [...CONCEPTOS_NAVIERA_BASE, ...extra, actual].map((c) => c.trim()).filter(Boolean);
  return Array.from(new Set(todas));
}

interface Props { value: string; onChange: (v: string) => void }

export function ConceptoNavieraSelect({ value, onChange }: Props) {
  const [extra, setExtra] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState("");
  const agregar = () => {
    const c = nuevo.trim();
    if (!c) return;
    setExtra((prev) => [...prev, c]);
    onChange(c);
    setNuevo("");
  };
  return (
    <div className="space-y-2">
      <Label>Concepto</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-label="Concepto"><SelectValue placeholder="Selecciona" /></SelectTrigger>
        <SelectContent>{opcionesConcepto(extra, value).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input aria-label="Nuevo concepto" placeholder="Agregar nuevo concepto" value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} />
        <Button type="button" variant="outline" onClick={agregar} disabled={!nuevo.trim()}><Plus className="h-4 w-4" />Agregar</Button>
      </div>
    </div>
  );
}
