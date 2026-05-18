import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { openErrorReport } from "@/lib/ui/errorDetailsStore";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, debug, ...props }) {
        const hasDebug = Boolean(debug);
        return (
          <Toast
            key={id}
            {...props}
            duration={hasDebug ? Infinity : props.duration}
            onClick={hasDebug ? () => debug && openErrorReport(debug) : undefined}
            className={hasDebug ? "cursor-pointer" : undefined}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            {hasDebug && (
              <ToastAction
                altText="Ver detalles del error"
                onClick={(e) => {
                  e.stopPropagation();
                  if (debug) openErrorReport(debug);
                }}
              >
                Ver detalles
              </ToastAction>
            )}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
