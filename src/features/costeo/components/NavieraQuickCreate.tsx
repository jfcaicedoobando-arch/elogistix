/**
 * R-10 — Alta rápida de naviera desde el formulario de tarifas de costeo.
 * Antes había que salir a Configuración → Catálogos, perdiendo la captura.
 * Las restricciones de permiso las aplica la base de datos (RLS del catálogo).
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAdminNavieras } from "@/features/catalogos/hooks";

interface Props {
  /** Se invoca con el id de la naviera recién creada para seleccionarla. */
  onCreada: (id: string) => void;
}

export function NavieraQuickCreate({ onCreada }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const { agregarNaviera } = useAdminNavieras();

  const puedeGuardar = code.trim().length > 0 && name.trim().length > 0;

  const handleGuardar = () => {
    if (!puedeGuardar) return;
    agregarNaviera.mutate(
      { code: code.trim().toUpperCase(), name: name.trim() },
      {
        onSuccess: (creada: unknown) => {
          const id = (creada as { id?: string } | null)?.id;
          if (id) onCreada(id);
          setCode("");
          setName("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-7 px-1 text-2xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-3 w-3" /> Agregar naviera
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva naviera</DialogTitle>
            <DialogDescription>
              Se agrega al catálogo de la organización y queda seleccionada en la tarifa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="quick-naviera-code">Código (SCAC) *</Label>
              <Input
                id="quick-naviera-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. MSCU"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="quick-naviera-name">Nombre *</Label>
              <Input
                id="quick-naviera-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mediterranean Shipping Company"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleGuardar} disabled={!puedeGuardar || agregarNaviera.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
