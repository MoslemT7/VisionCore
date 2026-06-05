import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { login, register, logout as firebaseLogout } from "../hooks/useAuth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async (email, password) => {
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async (username, email, password) => {
    setError("");
    try {
      await register(email, password, username);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, error, handleLogin, handleRegister, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);