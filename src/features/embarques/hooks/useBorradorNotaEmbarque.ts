import { useEffect, useRef, useState } from "react";
import { useDirtyGuard } from "@/hooks/shared/useDirtyGuard";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { useCreateNotaEmbarque } from "./mutations/useNotaEmbarque";

/** El borrador pertenece al detalle, no a la pestaña que se desmonta al cambiar. */
export function useBorradorNotaEmbarque(embarqueId: string | undefined, expediente?: string | null) {
  const { user } = useAuth();
  const crearNota = useCreateNotaEmbarque();
  const registrarActividad = useRegistrarActividad();
  const enviosRef = useRef(new Set<string>());
  const [envios, setEnvios] = useState<string[]>([]);
  const [borrador, setBorrador] = useState({ embarqueId, texto: "" });
  const texto = borrador.embarqueId === embarqueId ? borrador.texto : "";
  useEffect(() => {
    setBorrador((actual) => actual.embarqueId === embarqueId ? actual : { embarqueId, texto: "" });
  }, [embarqueId]);
  const setTexto = (valor: string) => setBorrador((actual) =>
    actual.embarqueId === embarqueId ? { embarqueId, texto: valor } : actual,
  );
  const guard = useDirtyGuard(texto.length > 0, true);
  const enviarNota = async () => {
    if (!embarqueId || !texto.trim() || enviosRef.current.has(embarqueId)) return;
    const enviado = borrador;
    enviosRef.current.add(embarqueId);
    setEnvios([...enviosRef.current]);
    try {
      const notaId = await crearNota.mutateAsync({ embarqueId, contenido: texto.trim(), usuario: user?.email ?? "" });
      registrarActividad.mutate({ accion: "agregar_nota", modulo: "embarques",
        entidad_id: embarqueId, entidad_nombre: expediente ?? "",
        detalles: { nota: texto.trim(), notaId } });
      // La respuesta sólo confirma esta versión, nunca un borrador posterior.
      setBorrador((actual) => actual === enviado ? { ...actual, texto: "" } : actual);
    } catch {
      // La mutación informa el fallo. El borrador queda disponible para reintentar.
    } finally {
      enviosRef.current.delete(embarqueId);
      setEnvios([...enviosRef.current]);
    }
  };
  return { texto, setTexto, enviarNota, enviando: envios.includes(embarqueId ?? ""), ...guard };
}
