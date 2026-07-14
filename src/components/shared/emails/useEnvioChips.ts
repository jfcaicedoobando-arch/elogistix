/**
 * useEnvioChips — Deriva chips y handlers para el modal `EnviarDocumentoDialog`.
 *
 * Extraído del componente para mantenerlo por debajo del límite de 200 líneas
 * (Power of 10). Sin cambios funcionales.
 */
import { useMemo } from "react";
import {
  EMAIL_RE,
  type EnvioFormState,
} from "@/hooks/emails/useEnvioDocumentoForm";
import type { EmailChip } from "@/components/shared/emails/EmailChipsField";

export interface UseEnvioChipsResult {
  paraChips: EmailChip[];
  ccChips: EmailChip[];
  handleParaAdd: (email: string) => void;
  handleParaRemove: (email: string) => void;
  handleCcAdd: (email: string) => void;
  handleCcRemove: (email: string) => void;
}

export function useEnvioChips(form: EnvioFormState): UseEnvioChipsResult {
  const paraChips: EmailChip[] = useMemo(() => {
    return form.destinatarios.map((d) => {
      const contacto = d.contacto_id
        ? form.contactos.find((c) => c.id === d.contacto_id)
        : undefined;
      return {
        email: d.email,
        label: d.nombre ?? undefined,
        tag: contacto?.tipo ?? undefined,
        invalid: !EMAIL_RE.test(d.email),
      };
    });
  }, [form.destinatarios, form.contactos]);

  const ccChips: EmailChip[] = useMemo(() => {
    return form.ccManual
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => ({ email: e, invalid: !EMAIL_RE.test(e) }));
  }, [form.ccManual]);

  const handleParaAdd = (email: string) => {
    const emailLc = email.toLowerCase();
    const contacto = form.contactos.find((c) => c.email.toLowerCase() === emailLc);
    if (contacto) {
      form.setSeleccionados((s) => ({ ...s, [contacto.id]: true }));
      return;
    }
    if (form.emailsManualesAgregados.some((e) => e.toLowerCase() === emailLc)) return;
    form.pushManual(email);
  };

  const handleParaRemove = (email: string) => {
    const emailLc = email.toLowerCase();
    const desde = form.destinatarios.find((d) => d.email.toLowerCase() === emailLc);
    if (desde?.contacto_id) {
      form.setSeleccionados((s) => ({ ...s, [desde.contacto_id!]: false }));
    } else {
      form.quitarManual(email);
    }
  };

  const serializeCc = (list: string[]) => form.setCcManual(list.join(", "));

  const handleCcAdd = (email: string) => {
    const emailLc = email.toLowerCase();
    if (ccChips.some((c) => c.email.toLowerCase() === emailLc)) return;
    serializeCc([...ccChips.map((c) => c.email), email]);
  };

  const handleCcRemove = (email: string) => {
    serializeCc(ccChips.map((c) => c.email).filter((e) => e !== email));
  };

  return { paraChips, ccChips, handleParaAdd, handleParaRemove, handleCcAdd, handleCcRemove };
}
