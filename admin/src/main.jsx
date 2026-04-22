import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Catalog from "./pages/Catalog";
import App from "./App";
import "./index.css";

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
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
