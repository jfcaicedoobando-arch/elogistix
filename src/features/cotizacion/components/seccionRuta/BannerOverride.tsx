import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { OPTS, type Ctx } from "./overrideHelpers";

export default function BannerOverride({ ctx }: { ctx: Ctx }) {
  const { watch, setValue } = ctx;
  const tarifaId = watch("tarifaId");
  const override = watch("tarifaOverride") ?? {};
  const campos = Object.keys(override).filter(k => override[k]);
  if (!tarifaId || campos.length === 0) return null;

  const limpiar = () => setValue("tarifaOverride", {}, OPTS);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
      <span className="flex items-center gap-2 text-warning">
        <Pencil className="h-3.5 w-3.5" />
        Sobrescribiste {campos.length} campo(s) de la tarifa: <strong>{campos.join(", ")}</strong>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={limpiar}>Restaurar desde tarifa</Button>
    </div>
  );
}
