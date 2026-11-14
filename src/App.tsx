import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AdminPortal } from './components/AdminPortal';
import { LoginView, type PortalSpaceMode } from './components/LoginView';
import { StudentPortal } from './components/StudentPortal';
import { EASE_PRO } from './components/ui/MotionPrimitives';
import { apiFetch, clearSession, getStoredSession } from './lib/api';
import type { AuthUser } from './types';

function readInitialPortalMode(): PortalSpaceMode {
  if (typeof window !== 'undefined' && window.location.hash.includes('administration')) {
    return 'admin';
  }
  return 'student';
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredSession().user);
  const [portalMode, setPortalMode] = useState<PortalSpaceMode>(readInitialPortalMode);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('academia_ha_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('academia_ha_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('academia_ha_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!user) {
      const targetHash = portalMode === 'student' ? '#/portail-etudiant' : '#/portail-administration';
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } else {
      const targetHash = user.role === 'ETUDIANT' ? '#/espace-etudiant' : '#/espace-administration';
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [user, portalMode]);

  useEffect(() => {
    const session = getStoredSession();
    if (session.accessToken) {
      apiFetch<AuthUser>('/api/auth/me')
        .then((fresh) => setUser(fresh))
        .catch(() => {
          clearSession();
          setUser(null);
        });
    }
  }, []);

  const handleLogout = async () => {
    const prevRole = user?.role;
    const { refreshToken } = getStoredSession();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore network error during logout
    }
    clearSession();
    setPortalMode(prevRole === 'ETUDIANT' ? 'student' : 'admin');
    setUser(null);
  };

  const portalKey = !user ? `login-${portalMode}` : user.role === 'ETUDIANT' ? 'student' : 'admin';

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={portalKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE_PRO }}
        >
          {!user ? (
            <LoginView
              portalMode={portalMode}
              onChangePortalMode={setPortalMode}
              onSuccess={(u) => setUser(u)}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
            />
          ) : user.role === 'ETUDIANT' ? (
            <StudentPortal
              user={user}
              onLogout={() => void handleLogout()}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
            />
          ) : (
            <AdminPortal
              user={user}
              onLogout={() => void handleLogout()}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
