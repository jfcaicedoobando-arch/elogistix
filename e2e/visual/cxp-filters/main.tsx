import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { CxpFixture } from "./CxpFixture";
import "../index.css";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter><NuqsAdapter><CxpFixture /></NuqsAdapter></BrowserRouter>,
);
