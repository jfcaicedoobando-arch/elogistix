/**
 * Footer del diálogo de timbrado (extraído de `DialogTimbrarFactura`, O7).
 * Sin lógica de negocio: solo acciones del diálogo.
 */
import { Button } from "@/components/ui/button";

interface Props {
  mostrarCompacto: boolean;
  puedeTimbrar: boolean;
  timbrando: boolean;
  onExpandir: () => void;
  onCancelar: () => void;
  onConfirm: () => void;
}

export function DialogTimbrarFacturaFooter({
  mostrarCompacto,
  puedeTimbrar,
  timbrando,
  onExpandir,
  onCancelar,
  onConfirm,
}: Props) {
  return (
    <>
      {mostrarCompacto && (
        <Button variant="ghost" onClick={onExpandir} className="mr-auto">
          Editar datos fiscales
        </Button>
      )}
      <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
      <Button onClick={onConfirm} disabled={!puedeTimbrar || timbrando}>
        {timbrando ? "Timbrando…" : "Timbrar ahora"}
      </Button>
    </>
  );
}
