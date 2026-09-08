/**
 * Interruptor de visibilidad por empresa para catálogos globales.
 * Si la plataforma desactivó el elemento a nivel global, el interruptor queda
 * bloqueado y se explica el motivo (antes no había pista alguna).
 *
 * La explicación usa la primitiva accesible `Hint` (Tooltip visible con hover y
 * con foco de teclado): el `title` nativo no es accesible y está prohibido.
 */
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/shared/Hint";

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
    <Hint label={MOTIVO_BLOQUEO}>
      {/* El Switch deshabilitado no recibe foco: el envoltorio enfocable permite
          leer el motivo también con teclado. */}
      <span
        className="inline-flex cursor-not-allowed"
        tabIndex={0}
        role="note"
        aria-label={`${ariaLabel}: ${MOTIVO_BLOQUEO}`}
      >
        {control}
      </span>
    </Hint>
  );
}
