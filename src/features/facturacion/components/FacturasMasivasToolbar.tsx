import { useState } from "react";
import { Download, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useFacturasMasivas } from "../hooks/useFacturasMasivas";

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
  onMarked: (ids: readonly string[]) => void;
}

export function FacturasMasivasToolbar({ selectedIds, onClear, onMarked }: Props) {
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const { busy, progreso, descargarZip, reenviarEmail, marcarEnviada } = useFacturasMasivas(selectedIds, onMarked);
  const count = selectedIds.size;
  const disabled = count === 0;

  const confirmarReenvio = () => {
    setConfirmEmailOpen(false);
    return reenviarEmail();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border rounded-md">
      <span className="text-body font-medium">
        {count} seleccionada{count === 1 ? "" : "s"}
      </span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" disabled={disabled || !!busy} loading={busy === "zip"} onClick={descargarZip}>
        {busy !== "zip" && <Download className="h-4 w-4 mr-1" />}
        {busy === "zip" && progreso ? `Descargando ${progreso.hechas}/${progreso.total}…` : "Descargar ZIP"}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || !!busy} loading={busy === "email"} onClick={() => setConfirmEmailOpen(true)}>
        {busy !== "email" && <Mail className="h-4 w-4 mr-1" />}
        {busy === "email" && progreso ? `Reenviando ${progreso.hechas}/${progreso.total}…` : "Reenviar por email"}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || !!busy} loading={busy === "mark"} onClick={marcarEnviada}>
        {busy !== "mark" && <CheckCircle2 className="h-4 w-4 mr-1" />}
        Marcar enviada
      </Button>
      {count > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>Limpiar</Button>
      )}
      <ConfirmActionDialog
        open={confirmEmailOpen}
        onOpenChange={setConfirmEmailOpen}
        title="Reenviar facturas por email"
        description={
          <>
            Se reenviará por correo <strong>{count}</strong> factura(s) a los contactos
            principales de cada cliente. ¿Continuar?
          </>
        }
        confirmLabel="Reenviar"
        isPending={busy === "email"}
        onConfirm={confirmarReenvio}
      />
    </div>
  );
}
