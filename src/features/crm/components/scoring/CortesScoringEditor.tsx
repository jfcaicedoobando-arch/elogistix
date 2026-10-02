/** Editor de cortes A/B/C para un objeto. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCortesScoring, useGuardarCortes } from "@/features/crm/hooks/useScoringCrm";
import { validarCortes } from "@/features/crm/services/scoring/reglasScoringCrm";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";

export function CortesScoringEditor({ objeto }: { objeto: ObjetoPuntaje }) {
  const { data = [] } = useCortesScoring();
  const guardar = useGuardarCortes();
  const actual = data.find((c) => c.objeto === objeto);
  const [a, setA] = useState("80");
  const [b, setB] = useState("50");
  useEffect(() => {
    if (actual) { setA(String(actual.min_a)); setB(String(actual.min_b)); }
  }, [actual]);
  const error = validarCortes(Number(a), Number(b));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor={`corte-a-${objeto}`}>A desde</Label>
        <Input id={`corte-a-${objeto}`} type="number" className="w-24" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`corte-b-${objeto}`}>B desde</Label>
        <Input id={`corte-b-${objeto}`} type="number" className="w-24" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <p className="text-body-sm text-muted-foreground">C = menos de {b || "?"} puntos</p>
      <Button
        size="sm" disabled={!!error || guardar.isPending}
        onClick={() => guardar.mutate({ objeto, min_a: Number(a), min_b: Number(b) })}
      >Guardar cortes</Button>
      {error && <p className="w-full text-body-sm text-destructive">{error}</p>}
    </div>
  );
}
