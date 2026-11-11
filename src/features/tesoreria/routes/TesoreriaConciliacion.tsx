import { useSearchParams } from "react-router";
import { ConciliacionCuenta } from "./_sections/ConciliacionCuenta";

export default function TesoreriaConciliacion() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cuentaId = searchParams.get("cuenta") ?? "";
  const setCuentaId = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("cuenta", id); else next.delete("cuenta");
      return next;
    }, { replace: true });
  };
  // La cuenta delimita toda la selección, los formularios y los diálogos,
  // también cuando cambia mediante navegación atrás/adelante.
  return <ConciliacionCuenta key={cuentaId} cuentaId={cuentaId} setCuentaId={setCuentaId} />;
}
