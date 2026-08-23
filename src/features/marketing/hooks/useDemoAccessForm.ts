/**
 * Estado y envío del formulario de acceso a la demo.
 * Extraído de `DemoAccessDialog` para respetar el límite de 200 líneas.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { createDemoLead } from "@/features/marketing/services/demoLeads";
import { enterDemoMode } from "@/features/marketing/services/demoAccess";
import { demoAccessSchema } from "@/features/marketing/lib/demoAccessSchema";
import { ROUTES } from "@/constants/routes";
import { mensajeAmigableDemo } from "@/features/marketing/services/demoErrorCopy";

export interface DemoAccessValues {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  aceptaContacto: boolean;
}

const VACIO: DemoAccessValues = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  aceptaContacto: true,
};

export function useDemoAccessForm(onOpenChange: (open: boolean) => void) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [values, setValues] = useState<DemoAccessValues>(VACIO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof DemoAccessValues>(campo: K, valor: DemoAccessValues[K]) =>
    setValues((prev) => ({ ...prev, [campo]: valor }));

  const validar = () => {
    const parsed = demoAccessSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los campos.");
      return null;
    }
    if (!values.aceptaContacto) {
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

  return { values, set, loading, error, handleSubmit };
}
