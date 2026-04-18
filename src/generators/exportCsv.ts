/**
 * Genera y descarga un archivo CSV desde datos tabulares.
 */
export function exportToCsv(
  filename: string,
  headers: { key: string; label: string }[],
  rows: Record<string, unknown>[],
) {
  const escape = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headerLine = headers.map((h) => escape(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h.key])).join(","),
  );

  const csv = [headerLine, ...dataLines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
