import { Toaster as SonnerToaster } from "sonner";
import { toast as sonnerToast } from "sonner";
import { useEffect } from "react";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { subscribeErrorReportScope } from "@/lib/diagnostics/errorReportScope";
import "./toast.css";

/** Sonner handles lifecycle/animation; one scoped stylesheet owns the layout. */
export function Toaster() {
  const { theme } = useTheme();
  useEffect(() => subscribeErrorReportScope(() => { sonnerToast.dismiss(); }), []);
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      offset={{ bottom: "96px", right: "16px" }}
      mobileOffset={{ bottom: "96px", left: "16px", right: "16px" }}
      className="lc-toaster !z-toast"
      containerAriaLabel="Notificaciones"
      customAriaLabel="Notificaciones de LibreCarga"
      closeButton
      expand
      duration={4000}
      swipeDirections={["right"]}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Cerrar notificación",
        classNames: { toast: "lc-toast" },
      }}
    />
  );
}
