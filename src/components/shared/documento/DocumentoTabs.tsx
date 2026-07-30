/**
 * Pestañas de un documento financiero sincronizadas con la URL (`?tab=`),
 * para que cada sección sea enlazable y sobreviva a un refresh.
 */
import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface DocumentoTabItem {
  id: string;
  label: string;
  /** Contador opcional a la derecha del label (ej. # de pagos). */
  count?: number;
  content: ReactNode;
}

interface Props {
  tabs: DocumentoTabItem[];
  /** Nombre del parámetro en la URL. */
  param?: string;
  className?: string;
}

export function DocumentoTabs({ tabs, param = "tab", className }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get(param);
  const activo = tabs.some((t) => t.id === fromUrl) ? (fromUrl as string) : tabs[0]?.id;

  const onChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(param, value);
    setSearchParams(next, { replace: true });
  };

  if (tabs.length === 0) return null;

  return (
    <Tabs value={activo} onValueChange={onChange} className={cn("w-full", className)}>
      <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
            {t.label}
            {typeof t.count === "number" && t.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {t.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-4 space-y-4">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
