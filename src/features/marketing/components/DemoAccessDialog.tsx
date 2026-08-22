/**
 * Diálogo que captura datos de contacto antes de entrar al modo demo.
 * Guarda el lead en `demo_leads` (con UTM/referrer) y luego provisiona
 * la cuenta demo compartida.
 *
 * V-10 (auditoría visual 2026-08-21): usa `FormDialogShell` + `FormDialogSection`
 * como el resto de los modales tipo formulario del ERP.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { DemoAccessFields } from "./demoAccess/DemoAccessFields";
import { useDemoAccessForm } from "./demoAccess/useDemoAccessForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = "demo-access-form";

export function DemoAccessDialog({ open, onOpenChange }: Props) {
  const { values, set, loading, error, handleSubmit } = useDemoAccessForm(onOpenChange);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => (!loading ? onOpenChange(v) : undefined)}
      icon={Sparkles}
      title="Prueba la demo de Libre Carga"
      description="Datos de ejemplo listos para explorar. Déjanos tus datos y entramos."
      size="md"
      formId={FORM_ID}
      onSubmit={handleSubmit}
      footer={
        <FormDialogFooter
          formId={FORM_ID}
          onCancel={() => onOpenChange(false)}
          confirmLabel={loading ? "Abriendo demo…" : "Entrar a la demo"}
          cancelLabel="Cancelar"
          loading={loading}
        />
      }
    >
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DemoAccessFields values={values} set={set} />
    </FormDialogShell>
  );
}
