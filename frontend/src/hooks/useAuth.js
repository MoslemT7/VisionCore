import { useState } from "react";
import { login, register } from "../api/auth";

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [error, setError] = useState(null);

  async function handleLogin(username, password) {
    try {
      const data = await login(username, password);
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRegister(username, email, password) {
    try {
      await register(username, email, password);
      setError(null);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  return { token, error, handleLogin, handleRegister, logout };
}