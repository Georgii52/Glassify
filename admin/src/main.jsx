import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import "./index.css";

// Тянуть Catalog/App отдельными чанками: иначе @google/model-viewer грузится на /auth/login
// и может уронить весь бандл до монтирования React (белый экран, title из index.html есть).
const Catalog = lazy(() => import("./pages/Catalog"));
const App = lazy(() => import("./App"));

const router = createBrowserRouter(
  [
    { path: "/auth/login", element: <Login /> },
    {
      element: <ProtectedRoute />,
      children: [
        { path: "/", element: <Catalog /> },
        { path: "/editor", element: <App /> },
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
