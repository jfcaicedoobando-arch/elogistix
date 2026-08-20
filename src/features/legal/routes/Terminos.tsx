import { Seo } from "@/components/shared/Seo";
import { LEGAL_CONTENT_APPROVED } from "@/features/legal/config";
import { LegalEnRevision } from "@/features/legal/components/LegalEnRevision";
import { LegalShell } from "@/features/legal/components/LegalShell";

/**
 * Términos y condiciones. Contenido placeholder — pendiente de revisión legal.
 */
export default function Terminos() {
  const url = "https://librecarga.com/legal/terminos";
  const title = "Términos y condiciones · Libre Carga";
  const desc = "Términos y condiciones de uso de Libre Carga, la plataforma para agencias de carga mexicanas.";
  return (
    <>
      <Seo title={title} description={desc} canonical={url} ogTitle={title} ogDescription={desc} ogUrl={url} />
      {/* VT-09: sin fecha de actualización mientras el contenido sea placeholder. */}
      <LegalShell
        title="Términos y condiciones"
        updatedAt={LEGAL_CONTENT_APPROVED ? "4 de junio de 2026" : undefined}
        backTo="/"
      >
        {LEGAL_CONTENT_APPROVED ? (
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
        ) : (
          <LegalEnRevision />
        )}
      </LegalShell>
    </>
  );
}
