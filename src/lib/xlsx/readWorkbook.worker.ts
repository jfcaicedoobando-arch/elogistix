import * as XLSX from "xlsx";
import type { WorkbookRequest, WorkbookResponse } from "./readWorkbook";

self.onmessage = ({ data }: MessageEvent<WorkbookRequest>) => {
  let response: WorkbookResponse;
  try {
    const book = XLSX.read(data.buffer, { type: "array", cellDates: true });
    const sheet = (data.sheet ? book.Sheets[data.sheet] : undefined) ?? book.Sheets[book.SheetNames[0]];
    const rows = data.layout === "rows"
      ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true })
      : XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    response = { rows };
  } catch (error) {
    response = { error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
