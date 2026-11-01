"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { api, setStoredAccessToken } from "./api";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRoleOverride, setActiveRoleOverride] = useState(null);

  // Derive activeRole: user's selected override, or first assigned role, or fallback STUDENT
  const activeRole = useMemo(() => {
    if (activeRoleOverride && user?.roles?.includes(activeRoleOverride)) {
      return activeRoleOverride;
    }
    return user?.roles?.[0] || "STUDENT";
  }, [user, activeRoleOverride]);

  const setActiveRole = useCallback((role) => {
    setActiveRoleOverride(role);
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Attempt silent refresh first using HTTP-only cookie
        const data = await api.auth.refresh();
        if (mounted && data?.user) {
          setUser(data.user);
          setIsLoading(false);
          return;
        }
      } catch {
        // In local development only, allow student fallback if initial session check fails
        if (process.env.NODE_ENV === "development") {
          try {
            const loginData = await api.auth.login(
              "student@campusflow.edu",
              "CampusFlow@2026!"
            );
            if (mounted && loginData?.user) {
              setUser(loginData.user);
            }
          } catch {
            if (mounted) {
              setUser(null);
            }
          }
        } else {
          if (mounted) {
            setUser(null);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.auth.login(email, password);
      setUser(data.user);
      setActiveRoleOverride(data.user?.roles?.[0] || null);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout to guarantee client-side purge
    } finally {
      setUser(null);
      setActiveRoleOverride(null);
      setStoredAccessToken(null);
      setIsLoading(false);
    }
  }, []);

  // Quick switch role between demo accounts for easy inspection (development only)
  const switchRole = useCallback(async (role) => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    setIsLoading(true);
    try {
      const emailMap = {
        STUDENT: "student@campusflow.edu",
        FACULTY: "faculty@campusflow.edu",
        DEPARTMENT_HEAD: "faculty@campusflow.edu",
        FACILITY_MANAGER: "admin@campusflow.edu",
        ADMIN: "admin@campusflow.edu",
      };
      const email = emailMap[role] || "student@campusflow.edu";
      const data = await api.auth.login(email, "CampusFlow@2026!");
      setUser(data.user);
      setActiveRoleOverride(role);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper checks
  const hasRole = useCallback(
    (role) => Boolean(user?.roles?.includes(role)),
    [user]
  );

  const hasAnyRole = useCallback(
    (roles = []) => Boolean(user?.roles?.some((r) => roles.includes(r))),
    [user]
  );

  const isAuthorized = useCallback(
    (requiredRoles = []) => {
      if (!requiredRoles.length) return true;
      return Boolean(user?.roles?.some((r) => requiredRoles.includes(r)));
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      activeRole,
      setActiveRole,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      switchRole,
      hasRole,
      hasAnyRole,
      isAuthorized,
    }),
    [
      user,
      activeRole,
      setActiveRole,
      isLoading,
      login,
      logout,
      switchRole,
      hasRole,
      hasAnyRole,
      isAuthorized,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
