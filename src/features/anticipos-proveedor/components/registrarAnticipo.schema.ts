/** Esquema y catálogos del formulario "Registrar anticipo a proveedor". */
import { z } from "zod";

export const METODOS_PAGO = ["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"] as const;

export const registrarAnticipoSchema = z
  .object({
    proveedorId: z.string().uuid({ message: "Selecciona un proveedor" }),
    monto: z.coerce.number().positive({ message: "El monto debe ser mayor a cero" }),
    moneda: z.enum(["MXN", "USD", "EUR"]),
    fechaAnticipo: z.string().min(1, "La fecha es requerida"),
    // B-060 (v13.320.32): `metodo_pago` es NOT NULL DEFAULT 'Transferencia' en
    // `pagos_proveedor`. Sin capturarlo aquí, la RPC `aplicar_anticipo_a_factura`
    // insertaba NULL explícito y el 100% de los anticipos creados por UI eran
    // inaplicables. Ahora es requerido, default 'Transferencia'.
    metodoPago: z.enum(METODOS_PAGO),
    // Sin cuenta bancaria el anticipo no genera movimiento conciliable en tesorería.
    cuentaBancariaId: z.string().optional(),
    // Requerido cuando la moneda no es MXN: la aplicación a factura y el
    // equivalente en pesos dependen de él.
    tipoCambioUsd: z.coerce.number().optional(),
    referencia: z.string().optional(),
    notas: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.moneda !== "MXN" && !(Number(v.tipoCambioUsd) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tipoCambioUsd"],
        message: "Captura el tipo de cambio para convertir a pesos",
      });
    }
    if (v.metodoPago !== "Efectivo" && !v.cuentaBancariaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cuentaBancariaId"],
        message: "Selecciona la cuenta de donde sale el dinero",
      });
    }
  });

export type RegistrarAnticipoFormValues = z.infer<typeof registrarAnticipoSchema>;
