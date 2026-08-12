import { LEGAL_CONTACT_EMAIL } from "@/features/legal/config";
import { COPY_LEGAL } from "@/lib/copy/publicoCopy";

/**
 * UIB-08: aviso neutro que sustituye al cuerpo borrador mientras
 * `LEGAL_CONTENT_APPROVED` sea `false`. No contiene texto legal.
 */
export function LegalEnRevision() {
  return (
    <div className="mt-8 rounded-lg border border-border bg-muted/40 px-5 py-8 text-center">
      <p className="text-sm text-foreground">
        {COPY_LEGAL.enRevision}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {COPY_LEGAL.contacto}{" "}
        <a className="text-accent hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
