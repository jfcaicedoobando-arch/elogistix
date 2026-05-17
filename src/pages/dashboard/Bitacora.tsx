import { useState, useMemo } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PaginationControls from "@/components/shared/PaginationControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { BitacoraActividad } from "@/components/shared/BitacoraActividad";
import { useBitacora } from "@/hooks/shared/useBitacora";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { GRUPOS_ACCION } from "@/lib/domain/bitacoraDescripcion";

const MODULOS = [
  { valor: "todos", etiqueta: "Todos los módulos" },
  { valor: "embarques", etiqueta: "Embarques" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "proveedores", etiqueta: "Proveedores" },
  { valor: "cotizaciones", etiqueta: "Cotizaciones" },
  { valor: "facturas", etiqueta: "Facturas" },
  { valor: "usuarios", etiqueta: "Usuarios" },
  { valor: "auth", etiqueta: "Autenticación" },
];

const RANGOS = [
  { valor: "todo", etiqueta: "Todo el tiempo", dias: null as number | null },
  { valor: "hoy", etiqueta: "Hoy", dias: 0 },
  { valor: "7d", etiqueta: "Últimos 7 días", dias: 7 },
  { valor: "30d", etiqueta: "Últimos 30 días", dias: 30 },
];

const OPCIONES_PAGINA = [30, 60, 120, 300] as const;
const LIMITE_DEFAULT = 30;
const UMBRAL_VIRTUALIZAR = 60;

function calcularFechaDesde(valor: string): string | undefined {
  const rango = RANGOS.find((r) => r.valor === valor);
  if (!rango || rango.dias === null) return undefined;
  const ahora = new Date();
  if (rango.dias === 0) {
    ahora.setHours(0, 0, 0, 0);
    return ahora.toISOString();
  }
  ahora.setDate(ahora.getDate() - rango.dias);
  return ahora.toISOString();
}

export default function Bitacora() {
  const { isAdmin } = usePermissions();
  const [moduloFiltro, setModuloFiltro] = useState("todos");
  const [accionFiltro, setAccionFiltro] = useState("todas");
  const [rangoFiltro, setRangoFiltro] = useState("todo");
  const [pagina, setPagina] = useState(0);
  const [mostrarLogins, setMostrarLogins] = useState(false);
  const [limitePagina, setLimitePagina] = useState<number>(LIMITE_DEFAULT);

  const esAuth = moduloFiltro === "auth";

  const acciones = useMemo(() => {
    const grupo = GRUPOS_ACCION.find((g) => g.valor === accionFiltro);
    return grupo && grupo.acciones.length > 0 ? [...grupo.acciones] : undefined;
  }, [accionFiltro]);

  const fechaDesde = useMemo(() => calcularFechaDesde(rangoFiltro), [rangoFiltro]);

  const { data, isLoading } = useBitacora({
    modulo: moduloFiltro === "todos" ? undefined : moduloFiltro,
    acciones,
    fechaDesde,
    limite: limitePagina,
    pagina,
    excluirLogin: esAuth ? false : !mostrarLogins,
  });

  const actividades = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.ceil(total / limitePagina);

  function resetPagina<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPagina(0);
    };
  }

  function renderActividad() {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, indice) => (
            <Skeleton key={indice} className="h-8 w-full" />
          ))}
        </div>
      );
    }
    return <BitacoraActividad actividades={actividades} mostrarUsuario={isAdmin} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<History className="h-6 w-6" />}
        title="Bitácora de Actividad"
        description={
          isAdmin
            ? "Registro de todas las acciones realizadas en el sistema."
            : "Registro de tus acciones en el sistema."
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={moduloFiltro} onValueChange={resetPagina(setModuloFiltro)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            {MODULOS.map((modulo) => (
              <SelectItem key={modulo.valor} value={modulo.valor}>
                {modulo.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accionFiltro} onValueChange={resetPagina(setAccionFiltro)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            {GRUPOS_ACCION.map((grupo) => (
              <SelectItem key={grupo.valor} value={grupo.valor}>
                {grupo.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rangoFiltro} onValueChange={resetPagina(setRangoFiltro)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rango" />
          </SelectTrigger>
          <SelectContent>
            {RANGOS.map((rango) => (
              <SelectItem key={rango.valor} value={rango.valor}>
                {rango.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!esAuth && (
          <div className="flex items-center gap-2">
            <Switch
              id="mostrar-logins"
              checked={mostrarLogins}
              onCheckedChange={(v) => { setMostrarLogins(v); setPagina(0); }}
            />
            <Label htmlFor="mostrar-logins" className="text-xs text-muted-foreground cursor-pointer">
              Incluir logins
            </Label>
          </div>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? "registro" : "registros"}
        </span>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actividad</CardTitle>
        </CardHeader>
        <CardContent>{renderActividad()}</CardContent>
      </Card>

      <PaginationControls
        page={pagina}
        totalPages={totalPaginas}
        onPageChange={setPagina}
      />
    </div>
  );
}
