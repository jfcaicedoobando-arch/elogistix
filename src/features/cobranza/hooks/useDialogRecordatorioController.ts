import { useState } from "react";
import { RevisionDestinatarioError } from "@/features/cobranza/services/recordatorioCobranzaService";
import { useDestinatarioRecordatorio } from "./useDestinatarioRecordatorio";
import { useRecordatorioCobranza } from "./useRecordatorioCobranza";
import { useRecordatorioDialogScope } from "./useRecordatorioDialogScope";

function puedeConfirmar({ open, pending, consulting, queryError, review, email }: {
  open: boolean; pending: boolean; consulting: boolean; queryError: boolean;
  review: boolean; email: string | undefined;
}) {
  return open && !pending && !consulting && !queryError && !review && !!email;
}

export function useDialogRecordatorioController(facturaId: string | undefined,
  open: boolean, onOpenChange: (value: boolean) => void) {
  const [nota, setNota] = useState("");
  const destinatario = useDestinatarioRecordatorio(facturaId, open);
  const dialogScope = useRecordatorioDialogScope(facturaId, open);
  const envio = useRecordatorioCobranza();
  const confirmado = destinatario.data?.factura_id === facturaId ? destinatario.data?.destinatario : null;
  const email = confirmado?.email;
  const requiereRevision = envio.error instanceof RevisionDestinatarioError
    && envio.variables?.facturaId === facturaId;
  const consultando = destinatario.isPending || destinatario.isFetching;
  const puedeEnviar = puedeConfirmar({ open, pending: envio.isPending, consulting: consultando,
    queryError: destinatario.isError, review: requiereRevision, email });
  const errorMessage = requiereRevision ? envio.error?.message
    : destinatario.error instanceof RevisionDestinatarioError ? destinatario.error.message : undefined;

  const handleEnviar = () => {
    if (!puedeEnviar || !facturaId || !confirmado || !destinatario.isCurrentScope()) return;
    const scope = dialogScope.beginSubmission();
    envio.mutate({ facturaId, nota: nota.trim(), destinatarioConfirmado: confirmado }, {
      onSuccess: () => {
        if (!scope.isCurrent()) return;
        setNota("");
        onOpenChange(false);
      },
    });
  };
  const revisarDestinatario = async () => {
    const scope = dialogScope.capture();
    const result = await destinatario.refetch();
    if (result.isSuccess && scope.isCurrent()) envio.reset();
  };
  return { nota, setNota, email, consultando, puedeEnviar, requiereRevision, errorMessage,
    isPending: envio.isPending, isError: destinatario.isError || requiereRevision,
    handleEnviar, revisarDestinatario };
}
