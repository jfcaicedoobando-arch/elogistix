/**
 * Estado del diálogo "Aplicar anticipo a esta factura".
 *
 * Extraído de `AplicarAnticipoDesdeFacturaDialog.tsx` (límite de 200 líneas,
 * Power of 10): el componente sólo pinta; aquí viven la selección de anticipo,
 * el tope convertido al DOF de la fecha de aplicación y el envío a la RPC.
 */
import { useEffect, useMemo, useState } from "react";
import { todayLocalISO } from "@/lib/date/today";
import { notifyError } from "@/lib/ui/appFeedback";
import { parseMonto } from "@/lib/format/parseMonto";
import { useTcDofPorFecha } from "@/features/catalogos/hooks";
import { useAplicarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { calcularTopeAplicable } from "@/features/anticipos-proveedor/domain/topeAplicacionAnticipo";
import { validarMontoAplicacion } from "@/features/anticipos-proveedor/domain/validarMontoAplicacion";
import { evaluarDesajusteEmbarque } from "@/features/anticipos-proveedor/domain/avisoEmbarqueAnticipo";
import { ordenarAnticiposPorEmbarque } from "@/features/anticipos-proveedor/domain/ordenAnticiposPorEmbarque";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Args {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  saldoFactura: number;
  monedaFactura: string;
  anticipos: AnticipoProveedorRow[];
  facturaEmbarqueId?: string | null;
  facturaExpediente?: string | null;
}

export function useAplicarAnticipoDesdeFactura({
  open, onOpenChange, facturaId, saldoFactura, monedaFactura, anticipos,
  facturaEmbarqueId, facturaExpediente,
}: Args) {
  const aplicar = useAplicarAnticipo();
  // Los anticipos del mismo expediente se ofrecen primero (cruce natural).
  const anticiposOrdenados = useMemo(
    () => ordenarAnticiposPorEmbarque(anticipos, facturaEmbarqueId ?? null),
    [anticipos, facturaEmbarqueId],
  );
  const [anticipoId, setAnticipoId] = useState("");
  const [monto, setMonto] = useState("0");
  const [fecha, setFecha] = useState(todayLocalISO());

  const anticipo = useMemo(
    () => anticiposOrdenados.find((a) => a.id === anticipoId) ?? null,
    [anticiposOrdenados, anticipoId],
  );

  // MNY P1.3: el monto se captura en la moneda del ANTICIPO. El tope se calcula
  // convirtiendo el saldo de la factura con el DOF de la fecha de aplicación
  // (misma paridad que usa el servidor); sin paridad no se sugiere ni se acepta.
  const { data: tcDof } = useTcDofPorFecha(fecha);
  const tope = useMemo(
    () =>
      calcularTopeAplicable({
        disponible: anticipo?.disponible ?? 0,
        monedaAnticipo: anticipo?.moneda ?? monedaFactura,
        saldoFactura,
        monedaFactura,
        tc: tcDof ?? null,
      }),
    [anticipo, monedaFactura, saldoFactura, tcDof],
  );

  // Al abrir (o cambiar de anticipo) sugiere el máximo aplicable convertido.
  useEffect(() => {
    if (!open) return;
    if (!anticipoId && anticiposOrdenados.length > 0) {
      setAnticipoId(anticiposOrdenados[0].id);
      return;
    }
    if (anticipo) {
      const sugerido = tope.tope ?? 0;
      setMonto(sugerido > 0 ? sugerido.toFixed(2) : "0");
    }
  }, [open, anticipoId, anticipo, anticiposOrdenados, tope.tope]);

  const handleOpenChange = (o: boolean) => {
    if (!o) { setAnticipoId(""); setMonto("0"); setFecha(todayLocalISO()); }
    onOpenChange(o);
  };

  // Ola 9 · B5: parseo centralizado de montos tecleados.
  const montoNum = parseMonto(monto, NaN);

  const desajuste = useMemo(
    () =>
      evaluarDesajusteEmbarque({
        anticipoEmbarqueId: anticipo?.embarque_id ?? null,
        anticipoExpediente: anticipo?.embarque_expediente ?? null,
        facturaEmbarqueId: facturaEmbarqueId ?? null,
        facturaExpediente: facturaExpediente ?? null,
      }),
    [anticipo, facturaEmbarqueId, facturaExpediente],
  );

  const onSubmit = async () => {
    if (!anticipo) return;
    const check = validarMontoAplicacion({
      montoNum,
      disponible: anticipo.disponible,
      monedaAnticipo: anticipo.moneda,
      monedaFactura,
      tope: tope.tope,
      fecha,
    });
    if (!check.ok) {
      if (check.error) {
        notifyError(undefined, {
          title: check.error.title,
          description: check.error.description,
          method: check.error.method,
        });
      }
      return;
    }
    await aplicar.mutateAsync({
      anticipoId: anticipo.id, facturaId, monto: montoNum, fechaAplicacion: fecha,
    });
    handleOpenChange(false);
  };

  return {
    anticipoId, setAnticipoId, monto, setMonto, fecha, setFecha,
    anticipo, anticiposOrdenados, montoNum, tope, desajuste,
    isPending: aplicar.isPending, handleOpenChange, onSubmit,
  };
}
