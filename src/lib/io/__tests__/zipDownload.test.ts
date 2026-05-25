import { describe, it, expect, vi, beforeEach } from "vitest";

const savedFiles: Array<{ blob: Blob; name: string }> = [];

vi.mock("file-saver", () => ({
  saveAs: (blob: Blob, name: string) => {
    savedFiles.push({ blob, name });
  },
}));

import { downloadZip } from "@/lib/io/zipDownload";
import JSZip from "jszip";

beforeEach(() => {
  savedFiles.length = 0;
});

describe("downloadZip", () => {
  it("empaqueta los archivos en una carpeta y dispara la descarga", async () => {
    await downloadZip("docs", { "a.txt": "hola", "b.txt": "mundo" }, "out.zip");
    expect(savedFiles).toHaveLength(1);
    expect(savedFiles[0].name).toBe("out.zip");

    const zip = await JSZip.loadAsync(savedFiles[0].blob);
    const a = await zip.file("docs/a.txt")?.async("string");
    const b = await zip.file("docs/b.txt")?.async("string");
    expect(a).toBe("hola");
    expect(b).toBe("mundo");
  });

  it("acepta mapa vacío y aún así genera ZIP", async () => {
    await downloadZip("vacio", {}, "x.zip");
    expect(savedFiles).toHaveLength(1);
    const zip = await JSZip.loadAsync(savedFiles[0].blob);
    expect(Object.keys(zip.files)).toContain("vacio/");
  });
});
