import { describe, expect, it } from "vitest";
import { toTitleCase } from "@/lib/formatters/text";

describe("toTitleCase conserva siglas (#6)", () => {
  it("HC, QA y SA de CV", () => {
    expect(toTitleCase("40' HC")).toBe("40' HC");
    expect(toTitleCase("cliente (QA)")).toBe("Cliente (QA)");
    expect(toTitleCase("acme sa de cv")).toBe("Acme SA de CV");
  });
});
