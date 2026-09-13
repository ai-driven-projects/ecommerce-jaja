"use client";

import { useForm } from "react-hook-form";
import Image from "next/image";
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
import { toast } from "sonner";
import {
    UpdateProfileFormData,
    updateProfileSchema,
} from "../../data/schemas/user";
import { useAuth } from "@/modules/auth";

export function PersonalInformationForm() {
    const { user, updateProfile } = useAuth();
    const avatarSrc =
        user?.avatarUrl ??
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";

    const form = useForm<UpdateProfileFormData>({
        resolver: v.resolver(updateProfileSchema),
        defaultValues: {
            name: user!.name,
            email: user!.email,
        },
    });

    async function onSubmit(data: UpdateProfileFormData) {
        try {
            await updateProfile(data);
            toast.success("Perfil atualizado com sucesso");
        } catch (error) {
            toast.error("Erro ao atualizar perfil", {
                description: getErrorMessage(error),
            });
        }
    }

    return (
        <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
                <h2 className="text-base/7 font-semibold text-text-primary">
                    Informações Pessoais
                </h2>
                <p className="mt-1 text-sm/6 text-text-muted">
                    Gerencie suas informações pessoais e de contato.
                </p>
            </div>

            <Form
                form={form}
                className="md:col-span-2"
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                    <div className="col-span-full flex items-center gap-x-8">
                        <Image
                            alt={user?.name ?? "User avatar"}
                            src={avatarSrc}
                            className="size-24 flex-none rounded-lg bg-bg-card-hover object-cover outline -outline-offset-1 outline-border-subtle"
                            width={96}
                            height={96}
                        />
                        <div>
                            <button
                                type="button"
                                className="rounded-md border border-border-input bg-bg-input px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-card-hover"
                            >
                                Alterar avatar
                            </button>
                            <p className="mt-2 text-xs/5 text-text-muted">
                                JPG, GIF ou PNG. Máximo 1MB.
                            </p>
                        </div>
                    </div>

                    <div className="col-span-full">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            autoComplete="given-name"
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
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Endereço de e-mail</FormLabel>
                                    <FormControl>
                                        <Input
                                            readOnly
                                            type="email"
                                            autoComplete="email"
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
