import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ESTADOS_COTIZACION } from "@/features/cotizacion/hooks";

type Cliente = { id: string; nombre: string };

export function EstadoSelect({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_COTIZACION.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ClienteSelect({
  value, onChange, clientes,
}: { value: string; onChange: (v: string) => void; clientes: Cliente[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los clientes</SelectItem>
        {clientes.map((cli) => (
          <SelectItem key={cli.id} value={cli.id}>
            {cli.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
