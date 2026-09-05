/**
 * Botón "Crear embarque" con flujo de revalidación de tarifa (Fase 1).
 *
 * 1. Llama `revalidar_tarifa_cotizacion`.
 * 2. Si `sin_cambios` → crea embarque directo con `decision='sin_cambios'`.
 * 3. Si `informativa` → abre `RevalidarTarifaModal` con opciones mantener /
 *    refrescar / sustituir (BuscarTarifaDialog).
 * 4. Si `bloqueante` → modal sólo permite "Solicitar re-aprobación a ventas".
 *
 * La lógica de estado/mutations vive en `useCrearEmbarqueConRevalidacion`.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { AlertTriangle } from "lucide-react";
import { RevalidarTarifaModal } from "@/features/cotizacion/components/revalidacion/RevalidarTarifaModal";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { useCrearEmbarqueConRevalidacion } from "@/features/cotizacion/hooks/useCrearEmbarqueConRevalidacion";

interface Props {
  cotizacionId: string;
  numContenedores: number;
}

export function CrearEmbarqueConRevalidacion({ cotizacionId, numContenedores }: Props) {
  const {
    resultado,
    modalOpen,
    setModalOpen,
    buscarOpen,
    setBuscarOpen,
    bloqueadoPorEsquema,
    revalidando,
    loading,
    handleClick,
    handleMantener,
    handleRefrescar,
    handleSustituir,
    handleTarifaElegida,
    handleSolicitarReaprobacion,
  } = useCrearEmbarqueConRevalidacion(cotizacionId);

  return (
    <>
      <Hint
        label={
          bloqueadoPorEsquema
            ? "Revalidación deshabilitada por un bug de sistema. Contacta a soporte."
            : undefined
        }
      >
        <Button
          size="sm"
          onClick={handleClick}
          disabled={revalidando || loading || bloqueadoPorEsquema}
          loading={revalidando}
          variant={bloqueadoPorEsquema ? "outline" : "default"}
        >
          {bloqueadoPorEsquema ? <AlertTriangle className="h-4 w-4 mr-2 text-warning" /> : null}
          {bloqueadoPorEsquema ? "Revalidación no disponible" : "Crear embarque"}
          {!bloqueadoPorEsquema && numContenedores > 1 && (
            <Badge variant="secondary" className="ml-2">{numContenedores}</Badge>
          )}
        </Button>
      </Hint>

      <RevalidarTarifaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        resultado={resultado}
        onMantener={handleMantener}
        onRefrescar={handleRefrescar}
        onSustituir={handleSustituir}
        onSolicitarReaprobacion={handleSolicitarReaprobacion}
        loading={loading}
      />

      <BuscarTarifaDialog
        open={buscarOpen}
        onOpenChange={setBuscarOpen}
        selectLabel="Usar esta tarifa para el embarque"
        onElegir={handleTarifaElegida}
      />
    </>
  );
}
