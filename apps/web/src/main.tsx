import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { initDataSource } from "./data/index";
import { migrateLegacyStorage } from "./lib/storageKeys";

migrateLegacyStorage();

void initDataSource().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
