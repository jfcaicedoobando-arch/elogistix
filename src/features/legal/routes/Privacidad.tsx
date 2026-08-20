import { Seo } from "@/components/shared/Seo";
import { LEGAL_CONTENT_APPROVED } from "@/features/legal/config";
import { LegalEnRevision } from "@/features/legal/components/LegalEnRevision";
import { LegalShell } from "@/features/legal/components/LegalShell";

/**
 * Aviso de privacidad. Contenido placeholder — pendiente de revisión legal.
 */
export default function Privacidad() {
  const url = "https://librecarga.com/legal/privacidad";
  const title = "Aviso de privacidad · Libre Carga";
  const desc = "Aviso de privacidad de Libre Carga: cómo recopilamos, usamos y protegemos los datos de nuestros clientes en México.";
  return (
    <>
      <Seo title={title} description={desc} canonical={url} ogTitle={title} ogDescription={desc} ogUrl={url} />
      <LegalShell title="Aviso de privacidad" updatedAt="4 de junio de 2026" backTo="/">
        {LEGAL_CONTENT_APPROVED ? (
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
        ) : (
          <LegalEnRevision />
        )}
      </LegalShell>
    </>
  );
}
