/**
 * Lista de empresas existentes que coinciden con lo que se escribe en el
 * nombre, para evitar capturar duplicados. Al elegir una se abre su ficha.
 */
import { Link } from "react-router";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useEmpresasSimilares } from "@/features/crm/hooks/useEmpresasSimilares";

interface Props { nombre: string; onElegir: () => void }

export function EmpresasSimilares({ nombre, onElegir }: Props) {
  const termino = useDebounce(nombre.trim(), 300);
  const q = useEmpresasSimilares(termino);
  if (termino.length < 2 || !q.data?.filas.length) return null;
  const filas = q.data.filas.slice(0, 6);
  return (
    <div className="rounded-md border bg-muted/40 p-2" role="region" aria-label="Empresas existentes">
      <p className="mb-1 text-caption text-muted-foreground">
        Ya existen {q.data.total} empresa{q.data.total === 1 ? "" : "s"} con ese nombre:
      </p>
      <ul className="space-y-0.5">
        {filas.map((f) => (
          <li key={f.id}>
            <Link to={`/crm/empresas/${f.id}`} onClick={onElegir}
              className="block rounded px-2 py-1 text-body-sm hover:bg-accent hover:text-accent-foreground">
              {f.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
