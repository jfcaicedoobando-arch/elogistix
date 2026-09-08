/**
 * Interruptor de visibilidad por empresa para catálogos globales.
 * Si la plataforma desactivó el elemento a nivel global, el interruptor queda
 * bloqueado y se explica el motivo (antes no había pista alguna).
 */
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  /** Visible para la empresa activa. */
  visible: boolean;
  /** Activo en el catálogo global (controlado por la plataforma). */
  activoGlobal: boolean;
  onChange: (visible: boolean) => void;
  ariaLabel: string;
};

const MOTIVO_BLOQUEO = "Desactivado globalmente por la plataforma; no puede habilitarse por empresa.";

export function SwitchVisibilidadOrg({ visible, activoGlobal, onChange, ariaLabel }: Props) {
  const control = (
    <Switch checked={visible} disabled={!activoGlobal} onCheckedChange={onChange} aria-label={ariaLabel} />
  );
  if (activoGlobal) return control;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed" tabIndex={0} aria-describedby={undefined} title={MOTIVO_BLOQUEO}>
            {control}
          </span>
        </TooltipTrigger>
        <TooltipContent>{MOTIVO_BLOQUEO}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
