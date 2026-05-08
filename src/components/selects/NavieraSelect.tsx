import { useState } from "react";
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavieras } from "@/hooks/catalogos/useNavieras";

interface NavieraSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function NavieraSelect({ value, onValueChange, placeholder = "Seleccionar naviera" }: NavieraSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: navieras = [], isLoading } = useNavieras();

  const selected = navieras.find(s => s.code === value);
  const label = selected ? `${selected.name} (${selected.code})` : "";
  // Valor inválido: ya hay value pero no matchea ninguna entrada del catálogo
  const isInvalid = !!value && !isLoading && !selected;

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              isInvalid && "border-destructive text-destructive",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {isInvalid && <AlertTriangle className="h-4 w-4 shrink-0" />}
              {label || (
                <span className={cn(isInvalid ? "text-destructive" : "text-muted-foreground")}>
                  {isInvalid ? `SCAC inválido: "${value}"` : placeholder}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar naviera por nombre o código..." />
            <CommandList>
              <CommandEmpty>No se encontró la naviera.</CommandEmpty>
              <CommandGroup>
                {navieras.map(line => (
                  <CommandItem
                    key={line.code}
                    value={`${line.name} ${line.code}`}
                    onSelect={() => { onValueChange(line.code); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === line.code ? "opacity-100" : "opacity-0")} />
                    {line.name} ({line.code})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-[11px] text-muted-foreground cursor-help">
            SCAC = Standard Carrier Alpha Code (4 letras), requerido para tracking automático.
          </p>
        </TooltipTrigger>
        <TooltipContent>
          Si tu naviera no aparece, agrégala con su SCAC oficial en Configuración → Catálogos → Navieras.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
