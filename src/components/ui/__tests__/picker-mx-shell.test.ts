/**
 * Cobertura de todas las combinaciones de estado para pickerTriggerClass y
 * verificación de las constantes de estilo compartidas de picker-mx-shell.
 */
import { describe, it, expect } from "vitest";
import {
  pickerTriggerClass,
  pickerErrorClass,
  pickerRootClass,
  pickerIconClass,
  pickerClearClass,
  pickerClearIconClass,
  PLACEHOLDER_FECHA,
  PLACEHOLDER_FECHA_HORA,
  PLACEHOLDER_PERIODO,
  MENSAJE_FECHA_INVALIDA,
} from "@/components/ui/picker-mx-shell";

describe("pickerTriggerClass", () => {
  it("sin estados: no incluye clases de error/disabled/empty", () => {
    const cls = pickerTriggerClass({});
    expect(cls).not.toMatch(/border-destructive/);
    expect(cls).not.toMatch(/cursor-not-allowed/);
    expect(cls).not.toMatch(/text-muted-foreground/);
    // v13.430.0 — el alto viene de FIELD_HEIGHT_CLASS (44px móvil / 40px ≥md).
    expect(cls).toMatch(/inline-flex w-full items-center/);
    expect(cls).toMatch(/h-11 md:h-10/);
  });

  it("showError=true agrega clases de error", () => {
    const cls = pickerTriggerClass({ showError: true });
    expect(cls).toMatch(/border-destructive/);
    expect(cls).toMatch(/focus-within:ring-destructive/);
  });

  it("disabled=true agrega clases de deshabilitado", () => {
    const cls = pickerTriggerClass({ disabled: true });
    expect(cls).toMatch(/opacity-50/);
    expect(cls).toMatch(/cursor-not-allowed/);
    expect(cls).toMatch(/bg-muted/);
  });

  it("empty=true agrega clase de texto atenuado", () => {
    const cls = pickerTriggerClass({ empty: true });
    expect(cls).toMatch(/text-muted-foreground/);
  });

  it("showError=false explícito no agrega clase de error", () => {
    const cls = pickerTriggerClass({ showError: false });
    expect(cls).not.toMatch(/border-destructive/);
  });

  it("disabled=false explícito no agrega clase de deshabilitado", () => {
    const cls = pickerTriggerClass({ disabled: false });
    expect(cls).not.toMatch(/cursor-not-allowed/);
  });

  it("empty=false explícito no agrega clase de vacío", () => {
    const cls = pickerTriggerClass({ empty: false });
    expect(cls).not.toMatch(/text-muted-foreground/);
  });

  it("showError + disabled combinados", () => {
    const cls = pickerTriggerClass({ showError: true, disabled: true });
    expect(cls).toMatch(/border-destructive/);
    expect(cls).toMatch(/cursor-not-allowed/);
    expect(cls).not.toMatch(/text-muted-foreground/);
  });

  it("showError + empty combinados", () => {
    const cls = pickerTriggerClass({ showError: true, empty: true });
    expect(cls).toMatch(/border-destructive/);
    expect(cls).toMatch(/text-muted-foreground/);
    expect(cls).not.toMatch(/cursor-not-allowed/);
  });

  it("disabled + empty combinados", () => {
    const cls = pickerTriggerClass({ disabled: true, empty: true });
    expect(cls).toMatch(/cursor-not-allowed/);
    expect(cls).toMatch(/text-muted-foreground/);
    expect(cls).not.toMatch(/border-destructive/);
  });

  it("showError + disabled + empty: las tres combinadas", () => {
    const cls = pickerTriggerClass({ showError: true, disabled: true, empty: true });
    expect(cls).toMatch(/border-destructive/);
    expect(cls).toMatch(/cursor-not-allowed/);
    expect(cls).toMatch(/text-muted-foreground/);
  });

  it("no deja espacios duplicados por clases vacías filtradas", () => {
    const cls = pickerTriggerClass({});
    expect(cls).not.toMatch(/ {2}/);
    expect(cls.startsWith(" ")).toBe(false);
    expect(cls.endsWith(" ")).toBe(false);
  });
});

describe("constantes de estilo y textos de picker-mx-shell", () => {
  it("expone los placeholders canónicos", () => {
    expect(PLACEHOLDER_FECHA).toBe("DD/MM/AAAA");
    expect(PLACEHOLDER_FECHA_HORA).toBe("DD/MM/AAAA HH:MM");
    expect(PLACEHOLDER_PERIODO).toBe("Ej. Agosto 2026");
  });

  it("expone el mensaje de fecha inválida", () => {
    expect(MENSAJE_FECHA_INVALIDA).toBe("Fecha inválida. Usa DD/MM/AAAA.");
  });

  it("expone las clases auxiliares fijas", () => {
    expect(pickerErrorClass).toBe("text-xs text-destructive");
    expect(pickerRootClass).toBe("flex w-full min-w-0 flex-col gap-1");
    expect(pickerIconClass).toBe("h-4 w-4 shrink-0 opacity-70");
    expect(pickerClearClass).toMatch(/rounded p-0.5/);
    expect(pickerClearIconClass).toBe("h-3.5 w-3.5");
  });
});
