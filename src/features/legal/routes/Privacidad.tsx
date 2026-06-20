import { Seo } from "@/components/shared/Seo";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";

/**
 * Aviso de privacidad. Contenido placeholder — pendiente de revisión legal.
 */
export default function Privacidad() {
  const url = "https://librecarga.com/legal/privacidad";
  const title = "Aviso de privacidad · Libre Carga";
  const desc = "Aviso de privacidad de Libre Carga: cómo recopilamos, usamos y protegemos los datos de nuestros clientes en México.";
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
        <h1 className="text-4xl font-bold tracking-tight">Aviso de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 4 de junio de 2026</p>
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Borrador — pendiente de revisión legal. Sustituir antes de producción.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
          <h2 className="text-xl font-semibold">1. Responsable</h2>
          <p>Libre Carga ("nosotros") es responsable del tratamiento de sus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>

          <h2 className="text-xl font-semibold">2. Datos que recabamos</h2>
          <p>Recabamos los datos que usted proporciona al crear su cuenta (nombre, correo, organización) y los datos operativos que captura en la plataforma (clientes, embarques, facturas).</p>

          <h2 className="text-xl font-semibold">3. Finalidades</h2>
          <ul className="list-disc pl-5">
            <li>Operar la plataforma y prestar el servicio contratado.</li>
            <li>Comunicarle novedades del producto y soporte.</li>
            <li>Cumplir obligaciones fiscales y legales aplicables.</li>
          </ul>

          <h2 className="text-xl font-semibold">4. Transferencias</h2>
          <p>No transferimos sus datos a terceros sin su consentimiento, salvo a proveedores tecnológicos necesarios para operar el servicio (hospedaje, correo transaccional).</p>

          <h2 className="text-xl font-semibold">5. Derechos ARCO</h2>
          <p>Usted puede ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición escribiendo a <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">contacto@librecarga.com</a>.</p>

          <h2 className="text-xl font-semibold">6. Cambios</h2>
          <p>Cualquier cambio a este aviso se publicará en esta página con la fecha de actualización.</p>
        </div>
      </main>
    </div>
  );
}
