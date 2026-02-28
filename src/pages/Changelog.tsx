import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ChangeType = "major" | "minor" | "patch";

interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.4.1",
    date: "2026-02-28",
    type: "patch",
    title: "Alta de usuarios desde el panel de administración",
    description:
      "Los administradores ahora pueden registrar nuevos usuarios directamente desde el módulo de Gestión de Usuarios, asignando email, contraseña y rol.",
  },
  {
    version: "1.4.0",
    date: "2026-02-28",
    type: "minor",
    title: "Módulo de usuarios con login y roles",
    description:
      "Sistema de autenticación con login/registro, gestión de roles (admin, operador, viewer), protección de rutas por rol y página de administración de usuarios.",
  },
  {
    version: "1.3.2",
    date: "2026-02-28",
    type: "patch",
    title: "Pricing simplificado",
    description:
      "Se eliminaron las líneas de IVA (16%) y Total (Con IVA) en el paso de Costos y Pricing. Ahora solo se muestra el Subtotal (Sin IVA) como entrada manual.",
  },
  {
    version: "1.3.1",
    date: "2026-02-27",
    type: "patch",
    title: "Dropdowns de conceptos marítimos",
    description:
      'Se agregaron opciones predefinidas "Flete marítimo" y "Revalidación" en los campos de concepto cuando el modo de transporte es Marítimo.',
  },
  {
    version: "1.3.0",
    date: "2026-02-26",
    type: "minor",
    title: "Costos y Pricing dinámico",
    description:
      "Nuevo paso en el wizard de embarque con filas dinámicas para conceptos de venta y costos. Incluye agregar/eliminar filas, cálculo de subtotal y utilidad estimada.",
  },
  {
    version: "1.2.1",
    date: "2026-02-25",
    type: "patch",
    title: "Validación de ruta marítima",
    description:
      "Todos los campos del paso 2 (Datos de Ruta) son obligatorios para embarques marítimos, excepto BL Master y BL House.",
  },
  {
    version: "1.2.0",
    date: "2026-02-24",
    type: "minor",
    title: "Wizard de Nuevo Embarque",
    description:
      "Formulario de 4 pasos para crear embarques: Datos Generales, Datos de Ruta, Documentos y Costos y Pricing. Incluye selectores de puertos, navieras y tipos de contenedor.",
  },
  {
    version: "1.1.0",
    date: "2026-02-20",
    type: "minor",
    title: "Wizard de Nuevo Cliente",
    description:
      "Diálogo de dos pasos para crear clientes. Requiere carga obligatoria de documentos (CIF, opinión fiscal, acta constitutiva, etc.) antes de guardar.",
  },
  {
    version: "1.0.0",
    date: "2026-02-15",
    type: "major",
    title: "Lanzamiento inicial",
    description:
      "Dashboard con KPIs y gráficas, listado y detalle de embarques, módulo de facturación, módulo de clientes con vista detalle, módulo de proveedores con CRUD completo, página de reportes y navegación lateral.",
  },
];

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historial de cambios y nuevas funcionalidades de la plataforma.
        </p>
      </div>

      <div className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {changelog.map((entry) => {
          const config = typeConfig[entry.type];
          return (
            <div key={entry.version} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm">v{entry.version}</span>
                    <Badge className={config.className}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{entry.date}</span>
                  </div>
                  <h3 className="font-semibold">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
