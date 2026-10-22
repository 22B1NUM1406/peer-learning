import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { connectSocket, disconnectSocket } from './socket.js';

// Нэвтэрсэн хэрэглэгчийн мэдээллийг бүх хуудсанд хүргэх Context.
// Cookie нь HttpOnly тул JavaScript уншиж чадахгүй: нэвтэрсэн эсэхийг /api/auth/me-ээс асууна.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () => api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)),
    [],
  );

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  // Нэвтэрсэн үед л бодит хугацааны холболт нээнэ (FR-22)
  useEffect(() => {
    if (user) connectSocket();
    else disconnectSocket();
  }, [user]);

  const login = async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(d.user);
  };

  const register = async (name, email, password) => {
    const d = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    setUser(d.user);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
