import { Seo } from "@/components/seo/Seo";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";

/**
 * Términos y condiciones. Contenido placeholder — pendiente de revisión legal.
 */
export default function Terminos() {
  const url = "https://librecarga.com/legal/terminos";
  const title = "Términos y condiciones · Libre Carga";
  const desc = "Términos y condiciones de uso de Libre Carga, la plataforma para agencias de carga mexicanas.";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo title={title} description={desc} canonical={url} ogTitle={title} ogDescription={desc} ogUrl={url} />
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Libre Carga"><BrandLockup variant="horizontal" size="sm" /></Link>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight">Términos y condiciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 4 de junio de 2026</p>
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Borrador — pendiente de revisión legal. Sustituir antes de producción.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
          <h2 className="text-xl font-semibold">1. Aceptación</h2>
          <p>Al crear una cuenta en Libre Carga, usted acepta estos Términos y nuestro Aviso de privacidad.</p>

          <h2 className="text-xl font-semibold">2. Servicio</h2>
          <p>Libre Carga es una plataforma SaaS para la operación de agencias de carga (cotizaciones, embarques, facturación y portal del cliente). Durante el lanzamiento el servicio es gratuito.</p>

          <h2 className="text-xl font-semibold">3. Cuenta</h2>
          <p>Usted es responsable de mantener la confidencialidad de sus credenciales y de toda actividad realizada en su cuenta.</p>

          <h2 className="text-xl font-semibold">4. Uso aceptable</h2>
          <ul className="list-disc pl-5">
            <li>No utilizar el servicio para fines ilícitos.</li>
            <li>No intentar acceder a datos de otras organizaciones.</li>
            <li>No interferir con la operación de la plataforma.</li>
          </ul>

          <h2 className="text-xl font-semibold">5. Disponibilidad</h2>
          <p>Trabajamos para mantener el servicio disponible 24/7, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos programados con aviso previo.</p>

          <h2 className="text-xl font-semibold">6. Datos del cliente</h2>
          <p>Los datos que usted carga son de su propiedad. Puede exportarlos o solicitar su eliminación en cualquier momento escribiendo a <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">contacto@librecarga.com</a>.</p>

          <h2 className="text-xl font-semibold">7. Cambios</h2>
          <p>Podremos actualizar estos Términos. Le avisaremos por correo o dentro del producto cuando haya cambios relevantes.</p>

          <h2 className="text-xl font-semibold">8. Ley aplicable</h2>
          <p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.</p>
        </div>
      </main>
    </div>
  );
}
