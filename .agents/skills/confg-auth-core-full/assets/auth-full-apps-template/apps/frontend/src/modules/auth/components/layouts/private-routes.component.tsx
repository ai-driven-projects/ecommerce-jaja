"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../data";
import { DashboardSkeleton } from "@/shared";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/sign-in");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return <>{children}</>;
}
