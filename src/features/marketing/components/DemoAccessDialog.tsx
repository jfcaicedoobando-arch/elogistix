/**
 * Diálogo que captura datos de contacto antes de entrar al modo demo.
 * Guarda el lead en `demo_leads` (con UTM/referrer) y luego provisiona
 * la cuenta demo compartida.
 *
 * V-10 (auditoría visual 2026-08-21): usa `FormDialogShell` + `FormDialogSection`
 * como el resto de los modales tipo formulario del ERP.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { createDemoLead } from "@/features/marketing/services/demoLeads";
import { enterDemoMode } from "@/features/marketing/services/demoAccess";
import { demoAccessSchema } from "@/features/marketing/lib/demoAccessSchema";
import { ROUTES } from "@/constants/routes";
import { mensajeAmigableDemo } from "@/features/marketing/services/demoErrorCopy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = "demo-access-form";

export function DemoAccessDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [aceptaContacto, setAceptaContacto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validar = (): { nombre: string; empresa: string; email: string; telefonoE164: string } | null => {
    const parsed = demoAccessSchema.safeParse({ nombre, empresa, email, telefono });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los campos.");
      return null;
    }
    if (!aceptaContacto) {
      setError("Necesitamos tu autorización para contactarte y darte acceso.");
      return null;
    }
    const phone = parsePhoneNumberFromString(parsed.data.telefono, "MX");
    if (!phone || !phone.isValid()) {
      setError("Teléfono inválido. Incluye la lada (ej: 55 1234 5678).");
      return null;
    }
    return {
      nombre: parsed.data.nombre,
      empresa: parsed.data.empresa,
      email: parsed.data.email,
      telefonoE164: phone.number,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const datos = validar();
    if (!datos) return;

    setLoading(true);
    try {
      await createDemoLead(datos);
      await enterDemoMode();
      toast({
        title: "Bienvenido al modo demo",
        // RUX-08: la re-siembra real es periódica (demo_seed_state; la edge
        // demo-access omite si se sembró hace <10 min, EF-09), no "en cada acceso".
        description: "Estás explorando datos de ejemplo. Se restablecen de forma periódica.",
      });
      onOpenChange(false);
      navigate(ROUTES.INICIO, { replace: true });
    } catch (err) {
      const msg = mensajeAmigableDemo(err);
      setError(msg);
      notifyError(undefined, {
        title: "No pudimos abrir la demo",
        description: msg,
        error: err,
        method: "DEMO_ACCESS_DIALOG",
      });
      setLoading(false);
    }
  };

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

      <FormDialogSection title="Tus datos">
        <div className="space-y-1.5">
          <Label htmlFor="demo-nombre">Nombre completo</Label>
          <Input
            id="demo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            placeholder="Juan Pérez"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-empresa">Empresa</Label>
          <Input
            id="demo-empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            autoComplete="organization"
            placeholder="Mi Agencia S.A. de C.V."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-email">Email de trabajo</Label>
          <Input
            id="demo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="tu@agencia.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-telefono">Teléfono (WhatsApp)</Label>
          <Input
            id="demo-telefono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoComplete="tel"
            placeholder="55 1234 5678"
            inputMode="tel"
            required
          />
          <p className="text-2xs text-muted-foreground">
            Con lada. Para números fuera de México incluye el prefijo del país (+1, +34…).
          </p>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Autorización" cols={1} flat>
        <label className="flex items-start gap-2 text-body-sm text-muted-foreground">
          <Checkbox
            className="mt-0.5"
            checked={aceptaContacto}
            onCheckedChange={(checked) => setAceptaContacto(checked === true)}
          />
          <span>
            Autorizo a Libre Carga a contactarme por email o WhatsApp para dar seguimiento a mi
            prueba. Consulta el{" "}
            <a
              href="/legal/privacidad"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              aviso de privacidad
            </a>
            .
          </span>
        </label>
      </FormDialogSection>
    </FormDialogShell>
  );
}
