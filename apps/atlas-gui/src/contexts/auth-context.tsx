'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User as OidcUser } from 'oidc-client-ts';
import { getUserManager, loginWithCredentials as authLoginWithCredentials } from '@/lib/auth';

interface AuthContextValue {
  user: OidcUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  loginWithCredentials: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const um = getUserManager();
    const clearUser = () => setUser(null);

    um.getUser()
      .then((u) => {
        setUser(u && !u.expired ? u : null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    um.events.addUserLoaded(setUser);
    um.events.addUserUnloaded(clearUser);
    um.events.addSilentRenewError(clearUser);

    return () => {
      um.events.removeUserLoaded(setUser);
      um.events.removeUserUnloaded(clearUser);
      um.events.removeSilentRenewError(clearUser);
    };
  }, []);

  const login = useCallback(async () => {
    await getUserManager().signinRedirect();
  }, []);

  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    const u = await authLoginWithCredentials(username, password);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await getUserManager().signoutRedirect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user && !user.expired, login, loginWithCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
