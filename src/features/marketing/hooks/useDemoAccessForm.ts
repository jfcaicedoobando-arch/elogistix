/** API del formulario conservada para callers antiguos, sin efectos de acceso. */
import { useState, type FormEvent } from "react";
import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";

export interface DemoAccessValues {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  aceptaContacto: boolean;
}

const VACIO: DemoAccessValues = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  aceptaContacto: true,
};

export function useDemoAccessForm(_onOpenChange: (open: boolean) => void) {
  const [values, setValues] = useState<DemoAccessValues>(VACIO);
  const set = <K extends keyof DemoAccessValues>(campo: K, valor: DemoAccessValues[K]) =>
    setValues((prev) => ({ ...prev, [campo]: valor }));

  // Un submit directo o repetido tampoco guarda leads, invoca Auth ni navega.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
  };

  return {
    values,
    set,
    loading: false,
    error: DEMO_ACCESS_AVAILABILITY.message,
    availability: DEMO_ACCESS_AVAILABILITY,
    handleSubmit,
  };
}
