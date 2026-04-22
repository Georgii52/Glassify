import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import "./index.css";

const Catalog = lazy(() => import("./pages/Catalog"));
const App = lazy(() => import("./App"));

function RouterError() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      Ошибка маршрутизации админки. Откройте консоль браузера (F12) и пришлите
      текст красных сообщений.
    </div>
  );
}

// React Router v7: нельзя полагаться на pathless layout + child path: "/".
// Явный path: "/" у родителя и index: true у каталога — стабильная схема под basename /admin
const router = createBrowserRouter(
  [
    { path: "/auth/login", element: <Login /> },
    {
      path: "/",
      element: <ProtectedRoute />,
      errorElement: <RouterError />,
      children: [
        { index: true, element: <Catalog /> },
        { path: "editor", element: <App /> },
      ],
    },
  ],
  { basename: "/admin" },
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Suspense fallback={<div style={{ padding: 24 }}>Загрузка…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  </React.StrictMode>,
);
