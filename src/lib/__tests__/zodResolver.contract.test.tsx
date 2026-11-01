import { act, renderHook } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import {
  registrarAnticipoSchema,
  type RegistrarAnticipoFormInput,
  type RegistrarAnticipoFormValues,
} from "@/features/anticipos-proveedor/components/registrarAnticipo.schema";

// Contrato del adaptador al actualizar la dependencia: la coerción financiera,
// los defaults de tracking y los transforms no deben confundirse con la captura.
// El schema de llegada es privado; esta fixture conserva su default opcional.
const schema = z.object({
  monto: z.coerce.number().positive("Monto inválido"),
  origen: z.string().trim(),
  ubicacion: z.string().optional().default(""),
});
type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const input: Input = { monto: "125.50", origen: "  Valencia  " };
const options = { fields: {}, shouldUseNativeValidation: false };

describe("zodResolver · contratos de dependencia usados por formularios", () => {
  it.each([undefined, "async", "sync"] as const)(
    "con modo %s entrega defaults/coerción/transforms sin modificar la captura",
    async (mode) => {
      const resolver = zodResolver(schema, undefined, mode ? { mode, raw: false } : undefined);
      expectTypeOf(resolver).toEqualTypeOf<Resolver<Input, unknown, Output>>();
      expectTypeOf<Input["monto"]>().toEqualTypeOf<unknown>();
      expectTypeOf<Output["monto"]>().toEqualTypeOf<number>();
      expectTypeOf<Input["ubicacion"]>().toEqualTypeOf<string | undefined>();
      expectTypeOf<Output["ubicacion"]>().toEqualTypeOf<string>();

      expect(await resolver(input, undefined, options)).toEqual({
        errors: {}, values: { monto: 125.5, origen: "Valencia", ubicacion: "" },
      });
      expect(input).toEqual({ monto: "125.50", origen: "  Valencia  " });
      const invalid = await resolver({ ...input, monto: "0" }, undefined, options);
      expect(invalid.values).toEqual({});
      expect(invalid.errors.monto).toMatchObject({ type: "too_small", message: "Monto inválido" });
    },
  );

  it("raw true conserva input y tipos, pero sigue rechazando valores inválidos", async () => {
    const resolver = zodResolver(schema, undefined, { raw: true });
    expectTypeOf(resolver).toEqualTypeOf<Resolver<Input, unknown, Input>>();
    const valid = await resolver(input, undefined, options);
    expect(valid).toEqual({ errors: {}, values: input });
    expect(valid.values).not.toBe(input);
    expect(valid.values).not.toHaveProperty("ubicacion");
    const invalid = await resolver({ ...input, monto: "texto" }, undefined, options);
    expect(invalid.values).toEqual({});
    expect(invalid.errors.monto).toMatchObject({ type: "invalid_type" });
  });

  it("el modo async predeterminado espera refinements y traduce sus errores", async () => {
    const asyncSchema = z.object({
      email: z.string().refine(async (email) => email !== "ocupado@empresa.test", "Correo ocupado"),
    });
    const resolver = zodResolver(asyncSchema);
    expect(await resolver({ email: "nuevo@empresa.test" }, undefined, options)).toEqual({
      values: { email: "nuevo@empresa.test" }, errors: {},
    });
    const invalid = await resolver({ email: "ocupado@empresa.test" }, undefined, options);
    expect(invalid.values).toEqual({});
    expect(invalid.errors.email).toMatchObject({ type: "custom", message: "Correo ocupado" });
    await expect(zodResolver(asyncSchema, undefined, { mode: "sync" })(
      { email: "nuevo@empresa.test" }, undefined, options,
    )).rejects.toThrow(/parseAsync/);
  });

  it("RHF entrega el output financiero tipado a handleSubmit y conserva su input", async () => {
    const defaultValues: RegistrarAnticipoFormInput = {
      proveedorId: "11111111-1111-4111-8111-111111111111",
      monto: "125.50", moneda: "USD", fechaAnticipo: "2026-10-20",
      metodoPago: "Transferencia", cuentaBancariaId: "cuenta-fixture", tipoCambioUsd: "18.50",
    };
    const { result } = renderHook(() =>
      useForm<RegistrarAnticipoFormInput, unknown, RegistrarAnticipoFormValues>({
        resolver: zodResolver(registrarAnticipoSchema), defaultValues,
      }),
    );
    const onValid = vi.fn<(values: RegistrarAnticipoFormValues) => void>();
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.handleSubmit((values) => {
        expectTypeOf(values).toEqualTypeOf<RegistrarAnticipoFormValues>();
        expectTypeOf(values.monto).toEqualTypeOf<number>();
        onValid(values);
      }, onInvalid)();
    });
    expect(onValid).toHaveBeenCalledExactlyOnceWith({ ...defaultValues, monto: 125.5, tipoCambioUsd: 18.5 });
    expect(onInvalid).not.toHaveBeenCalled();
    expect(result.current.getValues()).toEqual(defaultValues);
    expectTypeOf(result.current.getValues("monto")).toEqualTypeOf<unknown>();

    act(() => result.current.setValue("monto", "0"));
    await act(async () => { await result.current.handleSubmit(onValid, onInvalid)(); });
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onInvalid).toHaveBeenCalledWith(
      expect.objectContaining({ monto: expect.objectContaining({ type: "too_small" }) }), undefined,
    );
  });
});
