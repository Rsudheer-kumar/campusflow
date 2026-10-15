"use client";
import { createContext, useContext, useState, useEffect, useCallback, } from "react";
import { api, setStoredAccessToken } from "./api";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Initialize session on mount
    useEffect(() => {
        let mounted = true;
        async function initAuth() {
            try {
                // Try silent refresh first
                const data = await api.auth.refresh();
                if (mounted && data.user) {
                    setUser(data.user);
                    setIsLoading(false);
                    return;
                }
            }
            catch {
                // In local development only, allow student fallback if initial session check fails
                if (process.env.NODE_ENV === "development") {
                    try {
                        const loginData = await api.auth.login("student@campusflow.edu", "CampusFlow@2026!");
                        if (mounted && loginData.user) {
                            setUser(loginData.user);
                        }
                    }
                    catch {
                        if (mounted) {
                            setUser(null);
                        }
                    }
                } else {
                    if (mounted) {
                        setUser(null);
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
    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        try {
            const data = await api.auth.login(email, password);
            setUser(data.user);
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
