/**
 * Botón "Probar demo" — abre el diálogo de captura de lead antes de
 * provisionar la cuenta demo compartida y entrar al dashboard.
 */
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { DemoAccessDialog } from "@/features/marketing/components/DemoAccessDialog";

interface Props extends Omit<ButtonProps, "onClick" | "disabled" | "children"> {
  label?: string;
  hideIcon?: boolean;
}

export function ProbarDemoButton({ label = "Probar demo", hideIcon = false, ...rest }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button {...rest} onClick={() => setOpen(true)}>
        {hideIcon ? null : <Sparkles className="mr-1 h-4 w-4" />}
        {label}
      </Button>
      <DemoAccessDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
