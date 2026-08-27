import { useState, useMemo } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import PaginationControls from "@/components/shared/PaginationControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { BitacoraActividad } from "@/components/shared/BitacoraActividad";
import { BitacoraFiltros } from "@/features/dashboard/components/BitacoraFiltros";
import { useBitacora } from "@/hooks/shared";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { GRUPOS_ACCION } from "@/lib/domain/bitacoraDescripcion";
import { PageContainer } from "@/components/shared/PageContainer";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { ErrorState } from "@/components/shared/states/ErrorState";
import type { CursorBitacora } from "@/types/bitacora";


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
  useDocumentTitle("Bitácora");
  const { isAdmin } = usePermissions();
  // R6-FIX3: la bitácora es global de la organización activa (no sólo del usuario).
  const { organizationId } = useOrganization();
  const [moduloFiltro, setModuloFiltro] = useState("todos");
  const [accionFiltro, setAccionFiltro] = useState("todas");
  const [rangoFiltro, setRangoFiltro] = useState("todo");
  const [pagina, setPagina] = useState(0);
  // QA B-27: cursores keyset por página (0 = sin cursor). Al avanzar de forma
  // secuencial se usa el cursor; un salto arbitrario cae al offset clásico.
  const [cursores, setCursores] = useState<Record<number, CursorBitacora>>({});
  const [mostrarLogins, setMostrarLogins] = useState(false);
  const [limitePagina, setLimitePagina] = useState<number>(LIMITE_DEFAULT);

  const esAuth = moduloFiltro === "auth";

  const acciones = useMemo(() => {
    const grupo = GRUPOS_ACCION.find((g) => g.valor === accionFiltro);
    return grupo && grupo.acciones.length > 0 ? [...grupo.acciones] : undefined;
  }, [accionFiltro]);

  const fechaDesde = useMemo(() => calcularFechaDesde(rangoFiltro), [rangoFiltro]);

  const { data, isLoading, isError, refetch } = useBitacora({
    modulo: moduloFiltro === "todos" ? undefined : moduloFiltro,
    acciones,
    fechaDesde,
    limite: limitePagina,
    pagina,
    cursor: cursores[pagina] ?? null,
    excluirLogin: esAuth ? false : !mostrarLogins,
    organizationId,
  });

  const actividades = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.ceil(total / limitePagina);

  function resetPagina<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPagina(0);
      setCursores({});
    };
  }

  function irAPagina(nueva: number) {
    const cursorSiguiente = data?.cursorSiguiente;
    if (nueva === pagina + 1 && cursorSiguiente) {
      setCursores((prev) => ({ ...prev, [nueva]: cursorSiguiente }));
    }
    setPagina(nueva);
  }

  function renderActividad() {
    if (isError) {
      return <ErrorState onRetry={() => void refetch()} />;
    }
    if (isLoading) {
      return <ListSkeleton rows={8} />;
    }
    return (
      <BitacoraActividad
        actividades={actividades}
        mostrarUsuario={isAdmin}
        virtualize={actividades.length >= UMBRAL_VIRTUALIZAR}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<History className="h-6 w-6" />}
        title="Bitácora de actividad"
        description={
          isAdmin
            ? "Registro de todas las acciones realizadas en el sistema."
            : "Registro de tus acciones en el sistema."
        }
      />

      <BitacoraFiltros
        rangos={RANGOS}
        moduloFiltro={moduloFiltro}
        accionFiltro={accionFiltro}
        rangoFiltro={rangoFiltro}
        mostrarLogins={mostrarLogins}
        mostrarSwitchLogins={!esAuth}
        total={total}
        onModuloChange={resetPagina(setModuloFiltro)}
        onAccionChange={resetPagina(setAccionFiltro)}
        onRangoChange={resetPagina(setRangoFiltro)}
        onMostrarLoginsChange={resetPagina(setMostrarLogins)}
      />


      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Actividad</CardTitle>
        </CardHeader>
        <CardContent>{renderActividad()}</CardContent>
      </Card>

      {/* VB-23: con 1 solo registro (o cualquier total ≤ pageSize) la
          paginación completa era ruido visual con botones inútiles. */}
      <PaginationControls
        page={pagina}
        totalPages={totalPaginas}
        onPageChange={irAPagina}
        pageSize={limitePagina}
        onPageSizeChange={(s) => { setLimitePagina(s); setPagina(0); setCursores({}); }}
        pageSizeOptions={[...OPCIONES_PAGINA]}
        hideWhenSinglePage
      />
    </PageContainer>
  );
}
