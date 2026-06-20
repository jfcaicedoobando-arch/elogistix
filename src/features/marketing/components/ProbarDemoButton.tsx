/**
 * Botón "Probar demo" — provisiona la cuenta demo y entra al dashboard.
 * Reutilizable en Hero, Nav y CTA final de la landing.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/shared";
import { enterDemoMode } from "@/features/marketing/services/demoAccess";
import { Loader2, Sparkles } from "lucide-react";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props extends Omit<ButtonProps, "onClick" | "disabled" | "children"> {
  label?: string;
  hideIcon?: boolean;
}

export function ProbarDemoButton({ label = "Probar demo", hideIcon = false, ...rest }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await enterDemoMode();
      toast({
        title: "Bienvenido al modo demo",
        description: "Estás explorando datos de ejemplo. Se reinician en cada acceso.",
      });
      navigate("/inicio", { replace: true });
    } catch (err) {
      notifyError(toast, { title: "No pudimos abrir la demo",
        description: err instanceof Error ? err.message : "Intenta de nuevo en un momento.", error: err, method: "COMPONENTS_MARKETING_PROBARDEMOBUTTON_1" });
      setLoading(false);
    }
  };

  return (
    <Button {...rest} onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hideIcon ? null : (
        <Sparkles className="mr-1 h-4 w-4" />
      )}
      {loading ? "Abriendo demo…" : label}
    </Button>
  );
}
