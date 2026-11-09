import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// The public production export keeps the real panel available under NODE_ENV=test.
import { ReactQueryDevtools } from "@tanstack/react-query-devtools/production";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let client: QueryClient;

async function finishTransition(element: Element) {
  // jsdom does not emit the CSS transition event that removes an exiting panel/button.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  fireEvent.transitionEnd(element);
}

beforeEach(() => {
  localStorage.clear();
  // Devtools 5.106 renders a measured virtual list. jsdom has no layout;
  // supply only its viewport geometry, leaving the real cache, React/Solid
  // adapters and virtualizer intact. All unrelated elements keep zero size.
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("tsqd-queries-overflow-container") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("tsqd-queries-overflow-container") ? 800 : 0;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  client.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Query devtools with the real React and Solid adapters", () => {
  it("keeps the same cache after rerendering and closing/reopening the panel", async () => {
    const key = ["dependency-smoke", "org-fixture"];
    client.setQueryData(key, { total: 42 });
    const view = render(
      <QueryClientProvider client={client}>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>,
    );

    const opener = await screen.findByRole("button", { name: /open tanstack query devtools/i });
    const openerContainer = opener.parentElement!;
    fireEvent.click(opener);
    await finishTransition(openerContainer);
    await waitFor(() => expect(opener).not.toBeInTheDocument());
    const panel = await screen.findByRole("complementary", { name: /tanstack query devtools/i });
    expect(await within(panel).findByText(JSON.stringify(key))).toBeVisible();

    view.rerender(
      <QueryClientProvider client={client}>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      </QueryClientProvider>,
    );
    expect(screen.getAllByRole("complementary", { name: /tanstack query devtools/i })).toHaveLength(1);
    fireEvent.click(within(panel).getAllByRole("button", { name: /close tanstack query devtools/i })[0]);
    await finishTransition(panel);
    await waitFor(() => expect(panel).not.toBeInTheDocument());
    const reopenButton = await screen.findByRole("button", { name: /open tanstack query devtools/i });
    const reopenContainer = reopenButton.parentElement!;
    fireEvent.click(reopenButton);
    await finishTransition(reopenContainer);
    await waitFor(() => expect(reopenButton).not.toBeInTheDocument());

    const reopened = await screen.findByRole("complementary", { name: /tanstack query devtools/i });
    expect(await within(reopened).findByText(JSON.stringify(key))).toBeVisible();
    expect(client.getQueryData(key)).toEqual({ total: 42 });

    const addedKey = ["dependency-smoke", "org-next"];
    client.setQueryData(addedKey, { total: 84 });
    expect(await within(reopened).findByText(JSON.stringify(addedKey))).toBeVisible();

    client.removeQueries({ queryKey: addedKey, exact: true });
    await waitFor(() => expect(within(reopened).queryByText(JSON.stringify(addedKey))).not.toBeInTheDocument());
    expect(within(reopened).getByText(JSON.stringify(key))).toBeVisible();
    expect(client.getQueryData(key)).toEqual({ total: 42 });

    view.unmount();
    expect(screen.queryByRole("complementary", { name: /tanstack query devtools/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open tanstack query devtools/i })).not.toBeInTheDocument();
    expect(document.querySelector(".tsqd-parent-container")).not.toBeInTheDocument();
  });
});
