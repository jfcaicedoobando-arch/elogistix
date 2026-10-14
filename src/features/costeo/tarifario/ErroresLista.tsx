/** Lista de renglones con error; los demás renglones siguen cargables. */
export function ErroresLista({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null;
  return (
    <ul className="max-h-48 list-disc space-y-1 overflow-auto rounded-md border p-3 pl-6 text-destructive">
      {errores.slice(0, 100).map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}

type ConErrores = { errores: string[] } | null | undefined;

/** Errores del último guardado o, si no hay, los de la revisión previa. */
export function erroresVisibles(resultado: ConErrores, estado: { prep: { errores: string[] } } | null | undefined): string[] {
  return resultado?.errores ?? estado?.prep.errores ?? [];
}
