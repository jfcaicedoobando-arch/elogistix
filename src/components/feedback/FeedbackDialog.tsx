import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/shared/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crearReporte } from "@/services/feedback";
import { APP_VERSION } from "@/constants/appVersion";
import { getConsoleSnapshot } from "@/lib/feedback/consoleBuffer";
import { FeedbackForm, type FeedbackFormValues } from "./FeedbackForm";
import { FeedbackMisReportes } from "./FeedbackMisReportes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const { user, effectiveRole, organizationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pickerActive, setPickerActive] = useState(false);

  const currentUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}${window.location.hash}` : ""),
    [open],
  );

  const mutation = useMutation({
    mutationFn: async (v: FeedbackFormValues) => {
      if (!user) throw new Error("Usuario no autenticado");
      return crearReporte({
        tipo: v.tipo,
        titulo: v.titulo,
        descripcion: v.descripcion,
        url: currentUrl,
        elementoSelector: v.elemento?.selector ?? null,
        elementoTexto: v.elemento?.texto ?? null,
        metadata: {
          appVersion: APP_VERSION,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          dpr: window.devicePixelRatio,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          route: currentUrl,
          consoleLogs: getConsoleSnapshot(),
        },
        imagenes: v.imagenes,
        usuarioId: user.id,
        usuarioEmail: user.email ?? "",
        organizationId: organizationId ?? null,
        rolReportero: effectiveRole ?? null,
      });
    },
    onSuccess: () => {
      toast({ title: "Reporte enviado", description: "Gracias, lo revisaremos pronto." });
      qc.invalidateQueries({ queryKey: ["mis-reportes-feedback"] });
      qc.invalidateQueries({ queryKey: ["admin-reportes-feedback"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "No se pudo enviar el reporte", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open && !pickerActive} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reportar bug o sugerir mejora</DialogTitle>
          <DialogDescription>
            Tu reporte llega directo al equipo de Libre Carga junto con el contexto técnico necesario.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="nuevo">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="nuevo">Nuevo reporte</TabsTrigger>
            <TabsTrigger value="mios">Mis reportes</TabsTrigger>
          </TabsList>
          <TabsContent value="nuevo" className="mt-4">
            <FeedbackForm
              initialUrl={currentUrl}
              submitting={mutation.isPending}
              onSubmit={(v) => mutation.mutate(v)}
              onCancel={() => onOpenChange(false)}
              onPickerActiveChange={setPickerActive}
            />
          </TabsContent>
          <TabsContent value="mios" className="mt-4">
            {user && <FeedbackMisReportes usuarioId={user.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
