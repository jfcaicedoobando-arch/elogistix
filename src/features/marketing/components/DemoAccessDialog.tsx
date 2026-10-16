/** Un caller con open=true sólo recibe un aviso; no se monta el formulario. */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoAccessDialog({ open }: Props) {
  if (!open) return null;

  return (
    <Alert role="status">
      <AlertTitle>{DEMO_ACCESS_AVAILABILITY.label}</AlertTitle>
      <AlertDescription>{DEMO_ACCESS_AVAILABILITY.message}</AlertDescription>
    </Alert>
  );
}
