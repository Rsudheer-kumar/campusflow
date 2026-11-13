"use client";
import { createContext, useContext, useState, useEffect, useCallback, } from "react";
import { api, setStoredAccessToken, getStoredAccessToken, getStoredUser, setStoredUser } from "./api";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getStoredUser());
    const [isLoading, setIsLoading] = useState(() => !getStoredUser());

    // Initialize session on mount
    useEffect(() => {
        let mounted = true;
        async function initAuth() {
            // Restore from localStorage immediately if present
            const cachedUser = getStoredUser();
            const token = getStoredAccessToken();
            if (cachedUser && token && mounted) {
                setUser(cachedUser);
                setIsLoading(false);
            }

            try {
                // Silent refresh in background
                const data = await api.auth.refresh();
                if (mounted && data?.user) {
                    setUser(data.user);
                    setStoredUser(data.user);
                    setIsLoading(false);
                    return;
                }
            }
            catch (err) {
                // Only clear session if server explicitly returns 401 Unauthorized
                if (err?.status === 401) {
                    if (mounted) {
                        setUser(null);
                        setStoredUser(null);
                        setStoredAccessToken(null);
                    }
                } else if (process.env.NODE_ENV === "development" && !cachedUser) {
                    try {
                        const loginData = await api.auth.login("student@campusflow.edu", "CampusFlow@2026!");
                        if (mounted && loginData.user) {
                            setUser(loginData.user);
                        }
                    }
                    catch {
                        if (mounted) setUser(null);
                    }
                }
            }
            finally {
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
    const register = useCallback(async (payload) => {
        setIsLoading(true);
        try {
            const data = await api.auth.register(payload);
            setUser(data.user);
            return data;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        try {
            const data = await api.auth.login(email, password);
            setUser(data.user);
            return data;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const logout = useCallback(async () => {
        setIsLoading(true);
        try {
            await api.auth.logout();
            setUser(null);
            setStoredAccessToken(null);
        }
        finally {
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
                ADMIN: "admin@campusflow.edu",
                FACILITY_MANAGER: "admin@campusflow.edu",
            };
            const email = emailMap[role] || "student@campusflow.edu";
            const data = await api.auth.login(email, "CampusFlow@2026!");
            setUser(data.user);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    return (<AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            switchRole,
        }}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
