import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { seedDatabase } from "./db/db";

import "./styles/global.css";

// Инициализация IndexedDB (сидирование тестовых данных)
seedDatabase().catch((e) => {
    // чтобы не падало молча
    console.error("seedDatabase error:", e);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);