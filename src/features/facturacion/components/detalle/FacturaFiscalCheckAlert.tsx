/**
 * FacturaFiscalCheckAlert — muestra un aviso cuando el cliente ligado al
 * borrador tiene datos fiscales incompletos (RFC/CP/régimen). Desde v13.146.1
 * el RPC `convertir_proformas_a_factura` ya no bloquea la conversión por esto:
 * FacturAPI valida al timbrar. Este banner permite al usuario detectarlo y
 * corregir la ficha del cliente antes de emitir.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, UserCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clienteId: string;
  estado: string;
}

function esRfcValido(rfc: string | null | undefined): boolean {
  if (!rfc) return false;
  return rfc.trim().length >= 12;
}

function esCpValido(cp: string | null | undefined): boolean {
  if (!cp) return false;
  return /^\d{5}$/.test(cp.trim());
}

export function FacturaFiscalCheckAlert({ clienteId, estado }: Props) {
  const { data } = useQuery({
    queryKey: ["cliente-fiscal-check", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, rfc, codigo_postal, regimen_fiscal")
        .eq("id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  if (estado !== "Borrador" || !data) return null;

  const faltantes: string[] = [];
  if (!esRfcValido(data.rfc)) faltantes.push("RFC");
  if (!esCpValido(data.codigo_postal)) faltantes.push("código postal");
  if (!data.regimen_fiscal) faltantes.push("régimen fiscal");

  if (faltantes.length === 0) return null;

  return (
    <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Datos fiscales del cliente incompletos</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3 mt-1">
        <span>
          Para timbrar este borrador, el cliente debe tener: <strong>{faltantes.join(", ")}</strong>.
          FacturAPI rechazará el timbrado hasta completarlo.
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to={`/clientes/${clienteId}`}>
            <UserCog className="h-4 w-4 mr-1.5" /> Completar datos del cliente
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
