import { Bell, Check } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/formatters";
import {
  useNotificacionesInternas,
  type NotificacionInterna,
} from "@/features/notificaciones/hooks/useNotificacionesInternas";

export function NotificacionesPopover() {
  const navigate = useNavigate();
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } =
    useNotificacionesInternas();

  const handleClick = (n: NotificacionInterna) => {
    if (!n.leida) marcarLeida(n.id);
    if (n.enlace) navigate(n.enlace);
  };

  return (
    <Popover>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {noLeidas > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-2xs font-semibold leading-none flex items-center justify-center rounded-full"
                >
                  {noLeidas > 9 ? "9+" : noLeidas}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Notificaciones
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <SectionHeading
            as="h3"
            variant="subsection"
            actions={
              noLeidas > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => marcarTodasLeidas()}
                >
                  <Check className="mr-1 h-3 w-3" /> Marcar todas
                </Button>
              ) : undefined
            }
          >
            Notificaciones
          </SectionHeading>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notificaciones.length === 0 ? (
            <EmptyStateInline icon={Bell} message="Sin notificaciones" className="py-8" />
          ) : (
            <ul className="divide-y">
              {notificaciones.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors ${
                      !n.leida ? "bg-accent/10" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.leida && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {n.titulo}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                          {n.mensaje}
                        </div>
                        <div className="text-2xs text-muted-foreground mt-0.5">
                          {formatDate(n.created_at, "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
