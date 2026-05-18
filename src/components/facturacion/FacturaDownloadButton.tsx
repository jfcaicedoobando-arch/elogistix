import { Button } from "@/components/ui/button";
import { FileText, FileCode2 } from "lucide-react";
import { openFacturaInNewTab } from "@/services/storage";
import { toast } from "@/hooks/use-toast";

interface Props {
  stored: string;
  kind: "pdf" | "xml";
  size?: "sm" | "icon";
  className?: string;
}

export function FacturaDownloadButton({ stored, kind, size = "icon", className }: Props) {
  const Icon = kind === "pdf" ? FileText : FileCode2;
  const colorClass = kind === "pdf" ? "text-destructive" : "text-info";
  const label = kind === "pdf" ? "Descargar PDF" : "Descargar XML";
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await openFacturaInNewTab(stored);
    } catch (err) {
      toast({
        title: "No se pudo abrir el archivo",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };
  if (size === "icon") {
    return (
      <Button
        variant="outline"
        size="icon"
        className={className ?? "h-7 w-7"}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
      </Button>
    );
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={className ?? "inline-flex"}
    >
      <Icon className={`h-3.5 w-3.5 ${colorClass} hover:opacity-80`} />
    </button>
  );
}
