/**
 * Dialog "Vincular embarque" de un anticipo ya registrado.
 * Sirve para ligar, corregir o quitar el expediente al que corresponde el
 * dinero adelantado. No se permite en anticipos cancelados (lo valida la RPC).
 */
import { useEffect, useState } from "react";
import { Loader2, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { EmbarqueAnticipoPicker } from "./EmbarqueAnticipoPicker";
import { useVincularAnticipoEmbarque } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function VincularEmbarqueAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const vincular = useVincularAnticipoEmbarque();
  const [embarqueId, setEmbarqueId] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmbarqueId(anticipo?.embarque_id ?? null);
    setExpediente(anticipo?.embarque_expediente ?? null);
  }, [open, anticipo]);

  const onSubmit = async () => {
    if (!anticipo) return;
    await vincular.mutateAsync({ id: anticipo.id, embarqueId });
    onOpenChange(false);
  };

  const sinCambios = (anticipo?.embarque_id ?? null) === embarqueId;

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={vincular.isPending}>
        Cancelar
      </Button>
      <Button onClick={onSubmit} disabled={vincular.isPending || sinCambios}>
        {vincular.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {vincular.isPending ? "Guardando…" : embarqueId ? "Vincular embarque" : "Quitar embarque"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Ship}
      title="Vincular anticipo a un embarque"
      description="Indica el expediente al que corresponde el dinero adelantado para amarrarlo después con la factura del proveedor."
      size="md"
      footer={footer}
    >
      <FormDialogSection title="Embarque" cols={1}>
        <EmbarqueAnticipoPicker
          value={embarqueId}
          expediente={expediente}
          onChange={(id, exp) => { setEmbarqueId(id); setExpediente(exp); }}
        />
        <p className="text-xs text-muted-foreground">
          Es informativo: no bloquea a qué factura se aplica el anticipo, sólo avisa si no coinciden.
        </p>
      </FormDialogSection>
    </FormDialogShell>
  );
}
