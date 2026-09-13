"use client";
import { SignInPage as AuthSignInPage } from "@/modules/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/modules/auth";

export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);
  return <AuthSignInPage />;
}
