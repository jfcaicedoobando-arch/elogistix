import { useState } from "react";
import { DataTable, defineColumns, type SortDir } from "@/components/shared/DataTable";

type SyntheticPerson = { id: string; name: string };
const rows: SyntheticPerson[] = [
  { id: "zoe", name: "Zoe" },
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
];
const columns = defineColumns<SyntheticPerson>([
  { id: "name", header: "Name", accessorFn: row => row.name, enableSorting: true },
  { id: "detail", header: "Detail", accessorFn: row => row.id, enableSorting: false },
]);

export function KeyboardSortingFixture({ mode }: { mode: "client" | "server" }) {
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: "asc" });
  const [calls, setCalls] = useState(0);
  return (
    <main data-testid="keyboard-fixture" className="p-4 space-y-4" style={{ width: 720 }}>
      <h1>Ordenación nativa de DataTable: {mode}</h1>
      <button type="button" className="rounded border px-3 py-1">Antes de la tabla</button>
      <DataTable columns={columns} data={rows} rowKey={row => row.id} sortMode={mode}
        controlledSort={mode === "server" ? sort : undefined}
        onSortChange={mode === "server" ? (key, dir) => {
          // Functional counting preserves every callback even when React batches them.
          setCalls(value => value + 1);
          setSort({ key, dir });
        } : undefined} />
      <button type="button" className="rounded border px-3 py-1">Después de la tabla</button>
      <output data-testid="sort-state" className="block">{JSON.stringify({ calls, ...sort })}</output>
    </main>
  );
}
