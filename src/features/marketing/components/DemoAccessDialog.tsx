/**
 * Diálogo que captura datos de contacto antes de entrar al modo demo.
 * Guarda el lead en `demo_leads` (con UTM/referrer) y luego provisiona
 * la cuenta demo compartida.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { createDemoLead } from "@/features/marketing/services/demoLeads";
import { enterDemoMode } from "@/features/marketing/services/demoAccess";
import { demoAccessSchema } from "@/features/marketing/lib/demoAccessSchema";
import { ROUTES } from "@/constants/routes";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * UIB-01: nunca mostrar `err.message` crudo en la landing pública — los errores
 * de `functions.invoke` llegan en inglés ("Edge Function returned a non-2xx
 * status code"). El mensaje técnico sigue yendo a "Ver detalles"/Sentry vía
 * `error: err`.
 */
function mensajeAmigableDemo(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const m = raw.toLowerCase();
  if (m.includes("non-2xx") || m.includes("failed to fetch") || m.includes("network")) {
    return "No pudimos abrir la demo en este momento. Intenta de nuevo en unos minutos.";
  }
  if (m.includes("permission denied") || m.includes("row-level security")) {
    return "No pudimos registrar tus datos. Intenta de nuevo o escríbenos a contacto@librecarga.com.";
  }
  const traducido = getErrorMessage(err);
  // Si el helper central no tradujo (devolvió el crudo), usar copy propio.
  if (!traducido || traducido === raw) {
    return "No pudimos abrir la demo. Intenta de nuevo en un momento.";
  }
  return traducido;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = demoAccessSchema.safeParse({ nombre, empresa, email, telefono });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los campos.");
      return;
    }
    if (!aceptaContacto) {
      setError("Necesitamos tu autorización para contactarte y darte acceso.");
      return;
    }
    const phone = parsePhoneNumberFromString(parsed.data.telefono, "MX");
    if (!phone || !phone.isValid()) {
      setError("Teléfono inválido. Incluye la lada (ej: 55 1234 5678).");
      return;
    }

    setLoading(true);
    try {
      await createDemoLead({
        nombre: parsed.data.nombre,
        empresa: parsed.data.empresa,
        email: parsed.data.email,
        telefonoE164: phone.number,
      });
      await enterDemoMode();
      toast({
        title: "Bienvenido al modo demo",
        description: "Estás explorando datos de ejemplo. Se reinician en cada acceso.",
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
    <Dialog open={open} onOpenChange={(v) => (!loading ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">Prueba la demo de Libre Carga</DialogTitle>
          <DialogDescription className="text-center">
            Datos de ejemplo listos para explorar. Déjanos tus datos y entramos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
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
            <p className="text-xs text-muted-foreground">
              Con lada. Para números fuera de México incluye el prefijo del país (+1, +34…).
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
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

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Abriendo demo…" : "Entrar a la demo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
