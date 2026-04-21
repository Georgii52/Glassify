import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import axios from "axios";

const AuthCtx = createContext(null);
const COOKIE_NAME = import.meta.env.VITE_COOKIE_NAME;
const COOKIE_MAX_AGE = Number(import.meta.env.VITE_COOKIE_MAX_AGE);

function getCookie(name) {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Strict`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getCookie(COOKIE_NAME));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = useCallback(async (login, password) => {
    const { data } = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/auth/login`,
      { login, password },
    );
    const t = data.accessToken;
    setCookie(COOKIE_NAME, t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    deleteCookie(COOKIE_NAME);
    setToken(null);
  }, []);

  return (
    <AuthCtx.Provider
      value={{ token, login, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
