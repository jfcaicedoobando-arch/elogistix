type WorkbookOptions = {
  layout: "rows" | "objects";
  sheet?: string;
};

export type WorkbookRequest = WorkbookOptions & { buffer: ArrayBuffer };
export type WorkbookResponse =
  | { rows: unknown[][] | Record<string, unknown>[] }
  | { error: string };

export function readWorkbook(buffer: ArrayBuffer, options: WorkbookOptions & { layout: "rows" }): Promise<unknown[][]>;
export function readWorkbook(buffer: ArrayBuffer, options: WorkbookOptions & { layout: "objects" }): Promise<Record<string, unknown>[]>;
export function readWorkbook(buffer: ArrayBuffer, options: WorkbookOptions) {
  return new Promise<unknown[][] | Record<string, unknown>[]>((resolve, reject) => {
    const worker = new Worker(new URL("./readWorkbook.worker.ts", import.meta.url), { type: "module" });
    const fail = (message: string) => {
      worker.terminate();
      reject(new Error(message));
    };

    worker.onmessage = ({ data }: MessageEvent<WorkbookResponse>) => {
      if ("error" in data) {
        fail(data.error);
        return;
      }
      worker.terminate();
      resolve(data.rows);
    };
    worker.onerror = ({ message }) => fail(message || "No se pudo leer el archivo de Excel.");
    worker.onmessageerror = () => fail("No se pudo recibir la hoja de Excel.");
    try {
      worker.postMessage({ ...options, buffer } satisfies WorkbookRequest, [buffer]);
    } catch (error) {
      worker.terminate();
      reject(error);
    }
  });
}
