/**
 * NavieraFormDialog — alta/edición de navieras del catálogo (Q-13).
 * Usado desde `TabNavieras` (admin) y desde el empty-state de `NavieraSelect`.
 *
 * Fix del bug de overlay/pointer-events: al cerrar (crear o cancelar), Radix
 * puede dejar `<body>` con `pointer-events:none` cuando este Dialog se abrió
 * anidado sobre otro overlay (p.ej. el Popover de `NavieraSelect`). Forzamos
 * la limpieza en el siguiente frame si ya no queda ningún overlay abierto.
 */
import { useEffect, useState } from "react";
import { Ship, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useAdminNavieras } from "@/features/catalogos/hooks";
import type { Naviera } from "@/features/catalogos/services";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se provee, el modal edita esta naviera; si no, da de alta una nueva. */
  naviera?: Naviera | null;
  /** Nombre inicial sugerido al crear (p.ej. lo que el usuario buscó en el select). */
  nombreInicial?: string;
  onGuardado?: (naviera: { id?: string; code: string; name: string }) => void;
}

function limpiarPointerEventsSiNoHayOverlay(): void {
  requestAnimationFrame(() => {
    const hayOverlay = document.querySelector('[role="dialog"][data-state="open"]');
    if (hayOverlay) return;
    if (document.body.style.pointerEvents === "none") document.body.style.pointerEvents = "";
    if (document.body.hasAttribute("data-scroll-locked")) document.body.removeAttribute("data-scroll-locked");
  });
}

export function NavieraFormDialog({ open, onOpenChange, naviera, nombreInicial, onGuardado }: Props) {
  const { agregarNaviera, editarNaviera } = useAdminNavieras();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const esEdicion = !!naviera;

  useEffect(() => {
    if (!open) return;
    setCode(naviera?.code ?? "");
    setName(naviera?.name ?? nombreInicial ?? "");
  }, [open, naviera, nombreInicial]);

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v) limpiarPointerEventsSiNoHayOverlay();
  };

  const puede = code.trim().length > 0 && name.trim().length > 0;
  const pendiente = agregarNaviera.isPending || editarNaviera.isPending;

  const handleGuardar = () => {
    if (!puede || pendiente) return;
    const payload = { code: code.trim().toUpperCase(), name: name.trim() };
    if (esEdicion && naviera) {
      editarNaviera.mutate(
        { id: naviera.id, ...payload },
        { onSuccess: () => { onGuardado?.({ id: naviera.id, ...payload }); handleOpenChange(false); } },
      );
    } else {
      agregarNaviera.mutate(payload, {
        onSuccess: () => { onGuardado?.(payload); handleOpenChange(false); },
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Ship}
      title={esEdicion ? "Editar naviera" : "Nueva naviera"}
      description="Disponible para cotizaciones, tarifas y embarques de toda la organización."
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={!puede || pendiente} onClick={handleGuardar}>
            {pendiente && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {esEdicion ? "Guardar cambios" : "Crear naviera"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="naviera-code">Código</Label>
          <Input id="naviera-code" placeholder="MAERSK" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="naviera-name">Nombre</Label>
          <Input id="naviera-name" placeholder="Maersk Line" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
    </FormDialogShell>
  );
}
