import { createContext, useContext, useState, useEffect, useRef } from 'react';
import authService from '../services/auth.service';

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const IDLE_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  // Idle session timeout — auto-logout after IDLE_TIMEOUT_MS of no activity
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        await authService.logout();
        setUser(null);
      }, IDLE_TIMEOUT_MS);
    };

    IDLE_EVENTS.forEach(e => document.addEventListener(e, handleActivity, true));
    handleActivity(); // start the timer immediately on login

    return () => {
      clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(e => document.removeEventListener(e, handleActivity, true));
    };
  }, [user]);

  const login = async (email, password) => {
    const userData = await authService.login(email, password);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await authService.logout()
    setUser(null)
  };

  const updateUser = (patch) => {
    if (!user) return;
    const updatedUser = { ...user, ...patch };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
