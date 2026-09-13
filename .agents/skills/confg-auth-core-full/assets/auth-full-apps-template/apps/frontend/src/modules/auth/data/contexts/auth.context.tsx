"use client";

import React, { createContext, useState, useEffect, useCallback } from "react";
import Cookies from "js-cookie";
import {
  login as apiLogin,
  register as apiRegister,
  getMe as apiGetMe,
} from "../api/auth/auth.service";
import {
  updateProfile as apiUpdateProfile,
  changePassword as apiChangePassword,
} from "../api/user/user.service";
import { LoginFormData, RegisterFormData } from "../schemas/auth";

import { UpdateProfileFormData, ChangePasswordFormData } from "../schemas/user";
import {
  PermissionDTO,
  PermissionPolicy,
  UserDTO,
} from "__AUTH_PACKAGE_NAME__";
import { setupAuthInterceptor } from "@/shared";

export interface AuthContextType {
  user: UserDTO | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  updateProfile(data: UpdateProfileFormData): Promise<void>;
  changePassword(data: ChangePasswordFormData): Promise<void>;
  hasPermission(permissions: PermissionDTO[]): boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

const ACCESS_TOKEN_COOKIE = "access_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  console.log("user", user);

  useEffect(() => setupAuthInterceptor(), []);

  const setAuthCookies = useCallback((token: string) => {
    Cookies.set(ACCESS_TOKEN_COOKIE, token, {
      expires: 1 / 24,
      secure: process.env.NODE_ENV === "production",
    });
  }, []);

  const removeAuthCookies = useCallback(() => {
    Cookies.remove(ACCESS_TOKEN_COOKIE);
  }, []);

  const validateToken = useCallback(async () => {
    try {
      const userData = await apiGetMe();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error("Token validation failed:", error?.response);
      if (error?.response?.status === 401) {
        removeAuthCookies();
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [removeAuthCookies]);

  useEffect(() => {
    const token = Cookies.get(ACCESS_TOKEN_COOKIE);
    if (token) {
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, [validateToken]);

  const login = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      try {
        const response = await apiLogin(data);
        setAuthCookies(response.access_token);
        await validateToken();
      } catch (error) {
        removeAuthCookies();
        setUser(null);
        setIsAuthenticated(false);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthCookies, removeAuthCookies, validateToken],
  );

  const register = useCallback(async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await apiRegister(data);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeAuthCookies();
    setUser(null);
    setIsAuthenticated(false);
  }, [removeAuthCookies]);

  const updateProfile = useCallback(async (data: UpdateProfileFormData) => {
    try {
      await apiUpdateProfile(data);
      const updatedUser = await apiGetMe();
      setUser(updatedUser);
    } catch (error) {
      throw error;
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordFormData) => {
    try {
      await apiChangePassword(data);
    } catch (error) {
      throw error;
    }
  }, []);

  const hasPermission = useCallback(
    (required: PermissionDTO[]): boolean => {
      if (!user?.permissions?.length || !required.length) {
        return false;
      }

      const policy = new PermissionPolicy(user.permissions.map((p) => p.id));

      return policy.check(required);
    },
    [user?.permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        updateProfile,
        hasPermission,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
