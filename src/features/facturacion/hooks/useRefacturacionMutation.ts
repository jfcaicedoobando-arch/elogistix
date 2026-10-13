import { useMutation } from "@tanstack/react-query";
import type { OperacionRefacturacion } from "./useRefacturacionScope";

interface Callbacks<T, I> {
  onSuccess?: (data: T, input: I) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}
interface Params<I, T> {
  capturar: (input: I) => OperacionRefacturacion;
  ejecutar: (input: I, operacion: OperacionRefacturacion) => Promise<T>;
  refrescar: () => void;
  exito: (data: T, input: I) => void;
  fallo: (error: Error) => void;
}
interface Solicitud<I, T> extends Params<I, T> {
  input: I;
  operacion: OperacionRefacturacion;
  callbacks?: Callbacks<T, I>;
}

/** Captura argumentos y callbacks al invocar; TanStack puede actualizar sus options tras un render. */
export function useRefacturacionMutation<I, T>(p: Params<I, T>) {
  const mutacion = useMutation({
    mutationFn: (s: Solicitud<I, T>) => {
      s.operacion.assertCurrent();
      return s.ejecutar(s.input, s.operacion);
    },
    onSuccess: (data, s) => {
      // La continuación se decide antes de invalidar. Un refetch de cortesía
      // no debe impedir el cierre tras reasignar; la nueva RPC revalida de nuevo.
      if (s.operacion.isCurrent()) {
        s.exito(data, s.input);
        s.callbacks?.onSuccess?.(data, s.input);
      }
      s.refrescar();
    },
    onError: (error: Error, s) => {
      if (s.operacion.isCurrent()) { s.fallo(error); s.callbacks?.onError?.(error); }
      s.refrescar();
    },
    onSettled: (_data, _error, s) => { s.callbacks?.onSettled?.(); },
  });
  const solicitud = (input: I, callbacks?: Callbacks<T, I>): Solicitud<I, T> =>
    ({ ...p, input, operacion: p.capturar(input), callbacks });

  return {
    isPending: mutacion.isPending && Boolean(mutacion.variables?.operacion.isCurrent()),
    mutate: (input: I, c?: Callbacks<T, I>) => {
      const s = solicitud(input, c);
      if (s.operacion.isCurrent()) mutacion.mutate(s);
      else c?.onSettled?.(); // Un inicio rechazado también libera el cerrojo del llamador.
    },
    mutateAsync: (input: I, c?: Callbacks<T, I>) => {
      const s = solicitud(input, c);
      return mutacion.mutateAsync(s);
    },
  };
}
