import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, post, refreshSession, setAccessToken, setOnAuthLost } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const IDLE_MS = 15 * 60 * 1000; // automatic logoff

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOnAuthLost(() => { qc.clear(); setUser(null); });
    refreshSession().then((d) => d && setUser(d.user)).finally(() => setReady(true));
  }, [qc]);

  const login = useCallback(async (email, password) => {
    const d = await post('/auth/login', { email, password });
    setAccessToken(d.accessToken); setUser(d.user); return d.user;
  }, []);
  const register = useCallback(async (name, email, password) => {
    const d = await post('/auth/register', { name, email, password });
    setAccessToken(d.accessToken); setUser(d.user); return d.user;
  }, []);
  const logout = useCallback(async () => {
    try { await post('/auth/logout'); } catch { /* ignore */ }
    setAccessToken(null); qc.clear(); setUser(null);
  }, [qc]);
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    setAccessToken(null); qc.clear(); setUser(null);
  }, [qc]);

  // Idle timeout
  useEffect(() => {
    if (!user) return undefined;
    let t;
    const bump = () => { clearTimeout(t); t = setTimeout(logout, IDLE_MS); };
    const evs = ['click', 'keydown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [user, logout]);

  const value = useMemo(() => ({ user, ready, login, register, logout, changePassword }), [user, ready, login, register, logout, changePassword]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
