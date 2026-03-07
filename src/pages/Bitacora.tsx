import { useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PaginationControls from "@/components/PaginationControls";
import { BitacoraActividad } from "@/components/BitacoraActividad";
import { useBitacora } from "@/hooks/useBitacora";
import { usePermissions } from "@/hooks/usePermissions";

const MODULOS = [
  { valor: "todos", etiqueta: "Todos los módulos" },
  { valor: "embarques", etiqueta: "Embarques" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "proveedores", etiqueta: "Proveedores" },
  { valor: "facturas", etiqueta: "Facturas" },
  { valor: "usuarios", etiqueta: "Usuarios" },
  { valor: "auth", etiqueta: "Autenticación" },
];

const LIMITE_POR_PAGINA = 30;

export default function Bitacora() {
  const { isAdmin } = usePermissions();
  const [moduloFiltro, setModuloFiltro] = useState("todos");
  const [pagina, setPagina] = useState(0);

  const { data, isLoading } = useBitacora({
    modulo: moduloFiltro === "todos" ? undefined : moduloFiltro,
    limite: LIMITE_POR_PAGINA,
    pagina,
  });

  const actividades = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.ceil(total / LIMITE_POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6" />
          Bitácora de Actividad
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Registro de todas las acciones realizadas en el sistema."
            : "Registro de tus acciones en el sistema."}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={moduloFiltro}
          onValueChange={(valorSeleccionado) => {
            setModuloFiltro(valorSeleccionado);
            setPagina(0);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por módulo" />
          </SelectTrigger>
          <SelectContent>
            {MODULOS.map((modulo) => (
              <SelectItem key={modulo.valor} value={modulo.valor}>
                {modulo.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? "registro" : "registros"}
        </span>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actividad</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, indice) => (
                <Skeleton key={indice} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <BitacoraActividad actividades={actividades} mostrarUsuario={isAdmin} />
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina(pagina - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas - 1}
            onClick={() => setPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
