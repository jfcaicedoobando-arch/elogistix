/**
 * Router de pasos del asistente de refacturación. Vive aparte para mantener
 * baja la complejidad del diálogo contenedor.
 */
import { PasoDiagnostico } from "./PasoDiagnostico";
import { PasoCancelarRep } from "./PasoCancelarRep";
import { PasoFacturaNueva } from "./PasoFacturaNueva";
import { PasoCancelarOriginal } from "./PasoCancelarOriginal";
import { PasoReasignarPago } from "./PasoReasignarPago";
import type { RefacturarWizard } from "./useRefacturarWizard";

export function RefacturarPasoActual({ w }: { w: RefacturarWizard }) {
  const { s } = w;

  if (s.paso === 1) {
    return (
      <PasoDiagnostico
        numeroOriginal={s.original?.numero ?? ""}
        clienteOriginal={s.original?.cliente_nombre ?? ""}
        rfcOriginal={s.original?.rfc_cliente ?? null}
        total={s.original?.total ?? null}
        moneda={s.original?.moneda ?? "MXN"}
        clientes={w.clientes}
        clienteDestinoId={w.clienteDestinoId}
        onClienteDestino={w.setClienteDestinoId}
        rutaFiscal={w.rutaFiscal}
        onRutaFiscal={w.setRutaFiscal}
        motivo={w.motivo}
        onMotivo={w.setMotivo}
        bloqueado={Boolean(s.caso)}
        receptorDestino={w.receptorDestino}
      />
    );
  }

  if (s.paso === 2) {
    return (
      <PasoCancelarRep
        pagos={w.pagos}
        cargando={s.pagosCargando}
        cancelandoId={w.repEnCurso}
        onCancelarRep={w.handleCancelarRep}
      />
    );
  }

  if (s.paso === 3) {
    return (
      <PasoFacturaNueva
        facturaNueva={s.facturaNueva}
        clienteDestinoNombre={w.clienteDestinoNombre}
        duplicando={s.duplicar.isPending}
        consultando={s.facturaNuevaCargando}
        onDuplicar={() => s.duplicar.mutate()}
        onIrABorrador={w.handleIrABorrador}
        onRefrescar={s.refrescar}
        consistencia={w.consistencia}
        consistenciaCargando={w.consistenciaCargando}
      />
    );
  }

  if (s.paso === 4) {
    return (
      <PasoCancelarOriginal
        original={s.original}
        rutaFiscal={w.rutaFiscal}
        cancelando={w.cancelandoFactura}
        onCancelar={w.handleCancelarOriginal}
        onRefrescar={s.refrescar}
      />
    );
  }

  return (
    <PasoReasignarPago
      pagos={w.pagos}
      pagoSeleccionadoId={w.pagoSeleccionadoId}
      onSeleccionarPago={w.setPagoSeleccionadoId}
      facturaNueva={s.facturaNueva}
      ordenanteNombre={w.ordenanteNombre}
      onOrdenanteNombre={w.setOrdenanteNombre}
      ordenanteRfc={w.ordenanteRfc}
      onOrdenanteRfc={w.setOrdenanteRfc}
      bloqueoOrdenante={w.bloqueoOrdenanteActual}
      yaReasignado={w.yaReasignado}
    />
  );
}
