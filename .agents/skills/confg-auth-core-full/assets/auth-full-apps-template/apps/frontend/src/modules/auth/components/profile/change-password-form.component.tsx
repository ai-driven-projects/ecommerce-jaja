"use client";

import { useForm } from "react-hook-form";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    Input,
    FormMessage,
    getErrorMessage,
    FormButtonSubmit,
    v,
} from "@/shared";
import {
    ChangePasswordFormData,
    changePasswordSchema,
} from "../../data/schemas/user";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth";

export function ChangePasswordForm() {
    const { changePassword } = useAuth();
    const form = useForm<ChangePasswordFormData>({
        resolver: v.resolver(changePasswordSchema),
        defaultValues: {
            oldPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(data: ChangePasswordFormData) {
        try {
            await changePassword(data);
            toast.success("Senha alterada com sucesso");
        } catch (error) {
            toast.error("Erro ao alterar senha", {
                description: getErrorMessage(error),
            });
        }
    }

    return (
        <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
                <h2 className="text-base/7 font-semibold text-text-primary">
                    Alterar Senha
                </h2>
                <p className="mt-1 text-sm/6 text-text-muted">
                    Atualize a senha associada à sua conta.
                </p>
            </div>

            <Form
                form={form}
                className="md:col-span-2"
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                    <div className="col-span-full">
                        <FormField
                            control={form.control}
                            name="oldPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Senha atual</FormLabel>
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
                    </div>

                    <div className="col-span-full">
                        <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nova senha</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="col-span-full">
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirmar senha</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="mt-8 flex">
                    <FormButtonSubmit>Salvar</FormButtonSubmit>
                </div>
            </Form>
        </div>
    );
}
