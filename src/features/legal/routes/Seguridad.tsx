import { Seo } from "@/components/shared/Seo";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock, Users, Activity, DatabaseBackup, Mail } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { ROUTES } from "@/constants/routes";

/**
 * Página de confianza, seguridad y privacidad mantenida por Libre Carga.
 * Contenido editable por el equipo; no es una certificación independiente.
 */
export default function Seguridad() {
  const url = "https://librecarga.com/legal/seguridad";
  const title = "Centro de confianza y seguridad · Libre Carga";
  const desc = "Cómo Libre Carga protege la información de las agencias de carga mexicanas: controles de acceso, cifrado en tránsito, aislamiento por organización y respaldos.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo title={title} description={desc} canonical={url} ogTitle={title} ogDescription={desc} ogUrl={url} />

      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to={ROUTES.LANDING} aria-label="Libre Carga"><BrandLockup variant="horizontal" size="sm" /></Link>
          <Link to={ROUTES.LANDING} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Centro de confianza</p>
        <h1 className="text-4xl font-bold tracking-tight">Seguridad y privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 18 de junio de 2026</p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Esta página es contenido editable mantenido por Libre Carga para responder dudas frecuentes
          sobre seguridad y privacidad de la plataforma. No constituye una certificación independiente
          ni una auditoría de terceros.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card icon={<Lock className="h-5 w-5" />} title="Acceso y autenticación">
            Inicio de sesión por correo y contraseña con sesión gestionada por nuestro proveedor de
            autenticación. Cada cuenta puede activar restablecimiento de contraseña por correo.
            El acceso administrativo está restringido por rol dentro de cada organización.
          </Card>
          <Card icon={<Users className="h-5 w-5" />} title="Aislamiento por organización">
            Cada agencia opera en su propio espacio lógico. Las políticas a nivel de base de datos
            (Row-Level Security) validan la organización del usuario en cada consulta para impedir
            accesos cruzados entre clientes.
          </Card>
          <Card icon={<Activity className="h-5 w-5" />} title="Cifrado en tránsito">
            Todo el tráfico entre el navegador y la plataforma viaja por HTTPS/TLS. Las llamadas a
            la base de datos y a los servicios de respaldo se realizan sobre canales cifrados.
          </Card>
          <Card icon={<DatabaseBackup className="h-5 w-5" />} title="Respaldos y disponibilidad">
            La base de datos se respalda de forma automática por el proveedor de infraestructura.
            Trabajamos para mantener el servicio disponible 24/7 y publicamos los mantenimientos
            programados con anticipación.
          </Card>
        </div>

        <div className="prose prose-sm mt-12 max-w-none space-y-4 text-foreground/85">
          <h2 className="text-xl font-semibold">Datos que recabamos</h2>
          <p>
            Recabamos los datos necesarios para operar la plataforma: información de la cuenta
            (nombre, correo, organización) y los datos operativos que cada agencia captura
            (clientes, embarques, cotizaciones, facturas). Consulta nuestro{" "}
            <Link to={ROUTES.LEGAL_PRIVACIDAD} className="text-accent hover:underline">Aviso de privacidad</Link>{" "}
            para el detalle completo.
          </p>

          <h2 className="text-xl font-semibold">Subprocesadores e integraciones</h2>
          <p>
            Para operar el servicio nos apoyamos en proveedores tecnológicos de hospedaje, base de
            datos, correo transaccional y telemetría de errores. Estos proveedores procesan datos
            únicamente para prestar el servicio contratado por Libre Carga.
          </p>

          <h2 className="text-xl font-semibold">Retención y eliminación</h2>
          <p>
            Los datos que cada agencia carga son de su propiedad. Puedes exportar tu información o
            solicitar su eliminación escribiendo a <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">contacto@librecarga.com</a>.
            Conservamos respaldos por un periodo limitado para fines de recuperación operativa.
          </p>

          <h2 className="text-xl font-semibold">Responsabilidad compartida</h2>
          <p>
            Libre Carga es responsable de la seguridad de la plataforma (infraestructura, controles
            de acceso a nivel base de datos, cifrado en tránsito). Cada agencia es responsable de la
            gestión de usuarios dentro de su organización: asignar roles adecuados, revocar accesos
            de personal que ya no colabora y resguardar las credenciales de sus usuarios.
          </p>

          <h2 className="text-xl font-semibold">Reportar un problema de seguridad</h2>
          <p>
            Si identificas una posible vulnerabilidad o un incidente, escríbenos a{" "}
            <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">contacto@librecarga.com</a>{" "}
            con los detalles para reproducirlo. Confirmaremos la recepción y daremos seguimiento
            hasta la resolución.
          </p>

          <h2 className="text-xl font-semibold">Cumplimiento</h2>
          <p>
            Tratamos los datos personales conforme a la Ley Federal de Protección de Datos
            Personales en Posesión de los Particulares (LFPDPPP) de México. No reclamamos
            certificaciones (SOC 2, ISO 27001, PCI, HIPAA) que no hayamos obtenido formalmente; si
            tu organización requiere documentación adicional, contáctanos.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
            <p className="text-sm text-muted-foreground">
              ¿Tienes preguntas adicionales sobre seguridad o privacidad para tu organización?
            </p>
          </div>
          <a
            href="mailto:contacto@librecarga.com"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Mail className="h-4 w-4" /> Contactar al equipo
          </a>
        </div>
      </main>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
