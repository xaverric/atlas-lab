'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User as OidcUser } from 'oidc-client-ts';
import { getUserManager } from '@/lib/auth';

interface AuthContextValue {
  user: OidcUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const um = getUserManager();

    um.getUser().then((u) => {
      setUser(u && !u.expired ? u : null);
      setIsLoading(false);
    });

    um.events.addUserLoaded(setUser);
    um.events.addUserUnloaded(() => setUser(null));

    return () => {
      um.events.removeUserLoaded(setUser);
      um.events.removeUserUnloaded(() => setUser(null));
    };
  }, []);

  const login = useCallback(async () => {
    await getUserManager().signinRedirect();
  }, []);

  const logout = useCallback(async () => {
    await getUserManager().signoutRedirect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user && !user.expired, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
