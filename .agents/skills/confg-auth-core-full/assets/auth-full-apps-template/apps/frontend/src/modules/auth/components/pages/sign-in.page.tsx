"use client";
import { Logo, toast, v } from "@/shared";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginFormData, loginSchema, useAuth } from "@/modules/auth";
import { ArrowLeftIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    Input,
    FormMessage,
    getErrorMessage,
    useApp,
} from "@/shared";

export function SignInPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { themeMode, toggleThemeMode } = useApp();
    const googleLoginUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/google/start`;
    const form = useForm<LoginFormData>({
        resolver: v.resolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function handleLogin(data: LoginFormData) {
        try {
            await login(data);
            toast.success("Login realizado com sucesso");
            router.push("/dashboard");
        } catch (error) {
            toast.error("Falha ao fazer login", {
                description: getErrorMessage(error),
            });
        }
    }

    return (
        <>
            <div className="flex min-h-full bg-bg-page">
                <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                    <div className="mx-auto w-full max-w-sm lg:w-[420px]">
                        <div className="mb-5 flex items-center justify-between">
                            <Logo className="h-10" href="/" />
                            <button
                                type="button"
                                onClick={toggleThemeMode}
                                className="inline-flex items-center gap-2 rounded-[10px] border border-border-card bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                                title={
                                    themeMode === "dark"
                                        ? "Ativar modo claro"
                                        : "Ativar modo escuro"
                                }
                            >
                                {themeMode === "dark" ? (
                                    <SunIcon className="size-4" />
                                ) : (
                                    <MoonIcon className="size-4" />
                                )}
                                {themeMode === "dark"
                                    ? "Modo claro"
                                    : "Modo escuro"}
                            </button>
                        </div>

                        <div className="rounded-2xl border border-border-card bg-bg-card p-6 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.65)] sm:p-7">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                                    Entrar na sua conta
                                </h2>
                                <p className="mt-2 text-sm text-text-muted">
                                    Ainda não tem conta?{" "}
                                    <Link
                                        href="/auth/sign-up"
                                        className="text-accent-blue hover:opacity-85 transition-colors hover:text-text-secondary"
                                    >
                                        Criar uma conta
                                    </Link>
                                </p>

                                <span className="mt-2 text-sm text-text-muted">
                                    Deseja cancelar o login?{" "}
                                    <Link
                                        href="/"
                                        className="inline-flex items-center gap-0.5 text-accent-blue transition-colors hover:text-text-secondary"
                                    >
                                        <ArrowLeftIcon className="size-3" />
                                        Voltar ao site
                                    </Link>
                                </span>
                            </div>

                            <div className="mt-8">
                                <Form
                                    form={form}
                                    onSubmit={form.handleSubmit(handleLogin)}
                                    className="space-y-6"
                                >
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Endereço de e-mail
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="email"
                                                        autoComplete="email"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Senha</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        autoComplete="current-password"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-3">
                                            <div className="flex h-6 shrink-0 items-center">
                                                <div className="group grid size-4 grid-cols-1">
                                                    <input
                                                        id="remember-me"
                                                        name="remember-me"
                                                        type="checkbox"
                                                        className="col-start-1 row-start-1 appearance-none rounded-sm border border-border-input bg-bg-input checked:border-accent-blue checked:bg-accent-blue indeterminate:border-accent-blue indeterminate:bg-accent-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue forced-colors:appearance-auto"
                                                    />
                                                    <svg
                                                        fill="none"
                                                        viewBox="0 0 14 14"
                                                        className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-text-on-accent"
                                                    >
                                                        <path
                                                            d="M3 8L6 11L11 3.5"
                                                            strokeWidth={2}
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="opacity-0 group-has-checked:opacity-100"
                                                        />
                                                        <path
                                                            d="M3 7H11"
                                                            strokeWidth={2}
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="opacity-0 group-has-indeterminate:opacity-100"
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                            <label
                                                htmlFor="remember-me"
                                                className="block text-sm text-text-secondary"
                                            >
                                                Lembrar de mim
                                            </label>
                                        </div>

                                        <div className="text-sm">
                                            <a
                                                href="#"
                                                className="font-semibold text-accent-blue hover:opacity-85"
                                            >
                                                Esqueceu a senha?
                                            </a>
                                        </div>
                                    </div>

                                    <div>
                                        <button
                                            type="submit"
                                            className="flex w-full justify-center rounded-[10px] bg-linear-to-r from-[#2563EB] to-[#4F46E5] px-3 py-2.5 text-sm font-semibold text-text-on-accent transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
                                        >
                                            Entrar
                                        </button>
                                    </div>
                                </Form>{" "}
                            </div>

                            <div className="mt-8">
                                <div className="relative">
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 flex items-center"
                                    >
                                        <div className="w-full border-t border-border-card" />
                                    </div>
                                    <div className="relative flex justify-center text-sm font-medium">
                                        <span className="bg-bg-card px-6 text-text-muted">
                                            Ou continue com
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4">
                                    <a
                                        href={googleLoginUrl}
                                        className="flex w-full items-center justify-center gap-3 rounded-[10px] border border-border-input bg-bg-input px-3 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-card-hover"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                            className="h-5 w-5"
                                        >
                                            <path
                                                d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                                                fill="#EA4335"
                                            />
                                            <path
                                                d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                                                fill="#34A853"
                                            />
                                        </svg>
                                        <span className="text-sm/6 font-semibold">
                                            Google
                                        </span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative hidden w-0 flex-1 lg:block">
                    <div className="absolute inset-0 z-10 bg-linear-to-r from-bg-page/35 to-transparent" />
                    <Image
                        alt=""
                        src={"/login.png"}
                        className="absolute inset-0 size-full object-cover"
                        fill
                        priority
                    />
                </div>
            </div>
        </>
    );
}
