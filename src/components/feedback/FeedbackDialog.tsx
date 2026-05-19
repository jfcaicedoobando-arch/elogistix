import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DialogOverlay, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/shared/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crearReporte } from "@/services/feedback";
import { APP_VERSION } from "@/constants/appVersion";
import { getConsoleSnapshot } from "@/lib/feedback/consoleBuffer";
import { getBreadcrumbsSnapshot } from "@/lib/feedback/breadcrumbsBuffer";
import { FeedbackForm, type FeedbackFormValues } from "./FeedbackForm";
import { FeedbackMisReportes } from "./FeedbackMisReportes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CONTENT_CLASSES =
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-xl max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-overlay duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl";

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
          breadcrumbs: getBreadcrumbsSnapshot(),
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

  useEffect(() => {
    if (!pickerActive) return;
    document.body.classList.add("feedback-picker-active");
    return () => { document.body.classList.remove("feedback-picker-active"); };
  }, [pickerActive]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!mutation.isPending && !pickerActive) onOpenChange(v); }}>
      <DialogPrimitive.Portal>
        {!pickerActive && <DialogOverlay />}
        <DialogPrimitive.Content
          data-feedback-modal
          className={cn(CONTENT_CLASSES, pickerActive && "opacity-0 pointer-events-none")}
        >
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
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
