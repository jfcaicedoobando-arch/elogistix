/** Estado y mutaciones del asistente; cada continuación pertenece a su apertura/caso. */
import { useEffect, useRef, useState } from "react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useRefacturacionQueries } from "./useRefacturacionQueries";
import { useRefacturacionScope, type OperacionRefacturacion } from "./useRefacturacionScope";
import { useRefacturacionMutation } from "./useRefacturacionMutation";
import {
  abrirCasoRefacturacion, avanzarPasoRefacturacion, cerrarCasoRefacturacion,
  reasignarPagoFactura, type AbrirCasoInput, type ReasignarPagoInput,
} from "../services/refacturacion";
import { crearBorradorRefacturacionVerificado, verificarNuevaRefacturacion } from "../services/refacturacionNueva";

function fail(title: string, error: Error) {
  notifyError(undefined, { title, description: getErrorMessage(error), error,
    method: "FEATURES_FACTURACION_REFACTURACION" });
}

export function useRefacturacion(facturaId: string | null, open: boolean) {
  const [paso, setPaso] = useState(1);
  const datos = useRefacturacionQueries(facturaId, open);
  const { caso, refrescar } = datos;
  const capturarOperacion = useRefacturacionScope({ facturaId, casoId: caso?.id, nuevaId: caso?.factura_nueva_id, open, estado: datos.estadoFacturaNueva, leerContexto: datos.leerContextoRefacturacion });
  const duplicacionEnCurso = useRef<{ operacion: OperacionRefacturacion; promise: Promise<string> } | null>(null);
  const verificarNueva = (timbrada = true, esperadaId = caso?.factura_nueva_id ?? undefined,
    operacion = capturarOperacion(["vigente"], timbrada)) =>
    verificarNuevaRefacturacion(facturaId!, caso!.id, timbrada, esperadaId, operacion.assertCurrent);

  useEffect(() => {
    if (!open) return;
    setPaso(caso ? Math.min(Math.max(caso.paso_actual, 1), 5) : 1);
  }, [open, caso]);

  const abrir = useRefacturacionMutation({
    capturar: () => capturarOperacion(), refrescar,
    ejecutar: (input: AbrirCasoInput, operacion) => {
      operacion.assertCurrent();
      if (input.facturaId !== facturaId) throw new Error("La factura original cambió.");
      return abrirCasoRefacturacion(input);
    },
    exito: () => { notifySuccess(undefined, { title: "Caso de refacturación abierto" }); setPaso(2); },
    fallo: (e) => fail("No se pudo abrir el caso", e),
  });
  const avanzar = useRefacturacionMutation({
    capturar: (destino: number) => capturarOperacion(destino >= 4 ? ["vigente"] : undefined, destino >= 4), refrescar,
    ejecutar: async (destino: number, operacion) => {
      if (destino >= 4) await verificarNueva(true, undefined, operacion);
      operacion.assertCurrent();
      await avanzarPasoRefacturacion(caso!.id, destino);
    },
    exito: (_d, destino) => { setPaso(destino); },
    fallo: (e) => fail("No se pudo avanzar el paso", e),
  });
  const duplicar = useRefacturacionMutation({
    capturar: () => capturarOperacion(["sin_referencia"]), refrescar,
    ejecutar: (_input: void, operacion) => {
      if (!duplicacionEnCurso.current?.operacion.isCurrent()) {
        const entry = { operacion, promise: crearBorradorRefacturacionVerificado(facturaId!, caso!.id, operacion.assertCurrent) };
        duplicacionEnCurso.current = entry;
        void entry.promise.then(() => { if (duplicacionEnCurso.current === entry) duplicacionEnCurso.current = null; },
          () => { if (duplicacionEnCurso.current === entry) duplicacionEnCurso.current = null; });
      }
      return duplicacionEnCurso.current.promise;
    },
    exito: () => { notifySuccess(undefined, { title: "Borrador creado para el cliente destino" }); },
    fallo: (e) => fail("No se pudo crear el borrador", e),
  });
  const reasignar = useRefacturacionMutation({
    capturar: () => capturarOperacion(["vigente"], true), refrescar,
    ejecutar: async (input: ReasignarPagoInput, operacion) => {
      await verificarNueva(true, input.facturaDestinoId, operacion);
      operacion.assertCurrent();
      if (input.casoId !== caso?.id) throw new Error("El caso cambió. Actualiza el estado.");
      return reasignarPagoFactura(input);
    },
    exito: () => { notifySuccess(undefined, { title: "Pago reasignado a la nueva factura" }); },
    fallo: (e) => fail("No se pudo reasignar el pago", e),
  });
  const cerrar = useRefacturacionMutation({
    capturar: (cancelar: boolean) => capturarOperacion(cancelar ? undefined : ["vigente"], !cancelar), refrescar,
    ejecutar: async (cancelar: boolean, operacion) => {
      if (!cancelar) await verificarNueva(true, undefined, operacion);
      operacion.assertCurrent();
      await cerrarCasoRefacturacion(caso!.id, cancelar);
    },
    exito: (_d, cancelar) => { notifySuccess(undefined, { title: cancelar ? "Caso cancelado" : "Refacturación completada" }); },
    fallo: (e) => fail("No se pudo cerrar el caso", e),
  });
  return { ...datos, paso, setPaso, verificarNueva, capturarOperacion, abrir, avanzar, duplicar, reasignar, cerrar };
}
