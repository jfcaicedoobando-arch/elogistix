/** Esquema y catálogos del formulario "Registrar anticipo a proveedor". */
import { z } from "zod";
import { TC_MAX } from "@/features/cxp/services";

/** EC-08: tope razonable para el monto de un anticipo capturado por UI. */
const MONTO_MAX = 1_000_000_000;
/** Formato canónico de fecha ISO (yyyy-mm-dd) que entiende Postgres. */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const METODOS_PAGO = ["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"] as const;

export const registrarAnticipoSchema = z
  .object({
    proveedorId: z.string().uuid({ message: "Selecciona un proveedor" }),
    monto: z.coerce
      .number()
      .positive({ message: "El monto debe ser mayor a cero" })
      .max(MONTO_MAX, { message: "El monto excede el máximo permitido" })
      .multipleOf(0.01, { message: "El monto no puede tener más de 2 decimales" }),
    moneda: z.enum(["MXN", "USD", "EUR"]),
    fechaAnticipo: z
      .string()
      .min(1, "La fecha es requerida")
      .regex(FECHA_ISO, "La fecha debe tener formato AAAA-MM-DD"),
    // B-060 (v13.320.32): `metodo_pago` es NOT NULL DEFAULT 'Transferencia' en
    // `pagos_proveedor`. Sin capturarlo aquí, la RPC `aplicar_anticipo_a_factura`
    // insertaba NULL explícito y el 100% de los anticipos creados por UI eran
    // inaplicables. Ahora es requerido, default 'Transferencia'.
    metodoPago: z.enum(METODOS_PAGO),
    // Sin cuenta bancaria el anticipo no genera movimiento conciliable en tesorería.
    cuentaBancariaId: z.string().optional(),
    // Requerido cuando la moneda no es MXN: la aplicación a factura y el
    // equivalente en pesos dependen de él.
    tipoCambioUsd: z.coerce
      .number()
      .max(TC_MAX, { message: `El tipo de cambio no puede ser mayor a ${TC_MAX}` })
      .optional(),
    referencia: z.string().optional(),
    notas: z.string().optional(),
    // Vínculo opcional con el embarque (expediente) al que corresponde el
    // dinero adelantado. Permite amarrarlo después con la factura del proveedor.
    embarqueId: z.string().uuid().nullable().optional(),
    embarqueExpediente: z.string().nullable().optional(),
  })

  .superRefine((v, ctx) => {
    // EC-08: fecha real y en un rango de años razonable (typo de año, p. ej. 22026).
    if (FECHA_ISO.test(v.fechaAnticipo)) {
      const anio = Number(v.fechaAnticipo.slice(0, 4));
      const d = new Date(`${v.fechaAnticipo}T00:00:00`);
      if (Number.isNaN(d.getTime()) || anio < 2000 || anio > 2100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechaAnticipo"],
          message: "La fecha no es válida",
        });
      }
    }
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
