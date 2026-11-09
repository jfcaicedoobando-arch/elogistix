// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";

describe("jsdom 31 DOM and CSS contracts", () => {
  it("keeps scoped, escaped and compound selectors working after DOM changes", () => {
    document.body.innerHTML = `<section id="invoice:42">
      <button class="action" data-state="pending">Approve</button>
      <div><button class="action">Nested</button></div>
    </section>`;
    const invoice = document.querySelector("#invoice\\:42")!;
    const approve = invoice.querySelector(":scope > .action:is([data-state='pending'], [data-state='ready'])")!;
    expect(approve).toHaveTextContent("Approve");
    expect(invoice.querySelectorAll(":scope > .action")).toHaveLength(1);
    approve.setAttribute("data-state", "ready");
    expect(invoice.querySelector(":scope > .action[data-state='pending']")).toBeNull();
    expect(invoice.querySelector(":scope > .action[data-state='ready']")).toBe(approve);
    expect(() => invoice.querySelector("div > > span")).toThrow();
  });

  it("keeps computed styles live across custom property, class and stylesheet changes", () => {
    const style = document.createElement("style");
    style.textContent = `
      .invoice { --amount-color: rgb(12, 34, 56); }
      .invoice > .amount { color: var(--amount-color); }
      .invoice.approved { --amount-color: rgb(40, 80, 120); }
    `;
    document.head.append(style);
    document.body.innerHTML = `<div class="invoice"><span class="amount">42</span></div>`;
    const invoice = document.querySelector(".invoice")!;
    const amount = document.querySelector(".amount")!;
    const computed = window.getComputedStyle(amount);
    expect(computed.color).toBe("rgb(12, 34, 56)");
    invoice.classList.add("approved");
    expect(computed.color).toBe("rgb(40, 80, 120)");
    style.sheet!.insertRule(".amount { color: rgb(90, 60, 30) !important; }");
    expect(computed.color).toBe("rgb(90, 60, 30)");
  });

  it("preserves accessible queries, CSS visibility and portal cleanup on repeated React renders", async () => {
    const style = document.createElement("style");
    style.textContent = ".validation[hidden] { display: none; }";
    document.head.append(style);
    function Fixture() {
      const [open, setOpen] = useState(false);
      const [invalid, setInvalid] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Edit invoice</button>
        {open && createPortal(<section role="dialog" aria-label="Invoice">
          <label htmlFor="reference">Reference</label>
          <input id="reference" aria-invalid={invalid} />
          <p className="validation" role="alert" hidden={!invalid}>Reference is required</p>
          <button onClick={() => setInvalid(true)}>Validate</button>
          <button onClick={() => { setOpen(false); setInvalid(false); }}>Cancel</button>
        </section>, document.body)}
      </>;
    }
    const view = render(<Fixture />);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Edit invoice" }));
      expect(screen.getByRole("dialog", { name: "Invoice" })).toBeVisible();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("Reference is required")).not.toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Validate" }));
      await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
      expect(screen.getByLabelText("Reference")).toHaveAttribute("aria-invalid", "true");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    view.unmount();
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
  });

  it("supports canvas DOM attributes without claiming native raster rendering", () => {
    // The application has no native canvas consumer. PDF generation uses
    // @react-pdf/renderer, not jsdom's optional @napi-rs/canvas backend.
    const canvas = document.createElement("canvas");
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
    canvas.width = 42;
    canvas.height = 24;
    expect(canvas.getAttribute("width")).toBe("42");
    expect(canvas.getAttribute("height")).toBe("24");
  });
});
