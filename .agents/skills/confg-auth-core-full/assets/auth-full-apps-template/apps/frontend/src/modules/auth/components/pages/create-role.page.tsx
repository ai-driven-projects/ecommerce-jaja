"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
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
    MultiSelect,
    FormButtonSubmit,
    FormSection,
    v,
} from "@/shared";
import {
    CreateRoleFormData,
    createRoleSchema,
} from "../../data/schemas/role/create-role";
import { toast } from "sonner";
import { useRoleRegistration } from "../../data/hooks/use-role-registration.hook";
import { Can, PermissionCriticality } from "../shared";
import { PERMISSIONS } from "__AUTH_PACKAGE_NAME__";

export function CreateRolePage() {
    const normalizeRoleName = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9.]+/g, ".")
            .replace(/\.+/g, ".")
            .replace(/^\./, "")
            .replace(/\.$/, "");
    const { create, permissions, isLoadingPermissions } = useRoleRegistration();
    const form = useForm<CreateRoleFormData>({
        resolver: v.resolver(createRoleSchema),
        defaultValues: {
            name: "",
            description: "",
            permissionIds: [],
        },
    });

    async function onSubmit(data: CreateRoleFormData) {
        try {
            await create(data);
            toast.success("Role created successfully");
            form.reset();
        } catch (error) {
            toast.error("Failed to create role", {
                description: getErrorMessage(error),
            });
        }
    }

    const permissionFilter = (
        option: {
            label: string;
            description?: string;
            meta?: Record<string, unknown>;
        },
        search: string,
        normalize: (str: string) => string,
    ) => {
        const term = normalize(search);
        const alias = String(option.meta?.alias ?? "");
        const criticality = String(option.meta?.criticality ?? "");
        return [
            option.label,
            option.description ?? "",
            alias,
            criticality,
        ].some((field) => normalize(field).includes(term));
    };

    return (
        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
            <div className="pb-10">
                <FormSection
                    title="Criar Perfil"
                    description="Defina um novo perfil de usuário e suas permissões no sistema."
                >
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel>Nome do Perfil</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder="Ex: admin, financeiro, etc."
                                        onChange={(e) =>
                                            field.onChange(e.target.value)
                                        }
                                        onBlur={(e) => {
                                            field.onBlur();
                                            field.onChange(
                                                normalizeRoleName(e.target.value),
                                            );
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel>Descrição</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Descreva o que este perfil faz."
                                        {...field}
                                        className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </FormSection>

                <FormSection
                    title="Permissões"
                    description="Defina as permissões desse perfil"
                >
                    <FormField
                        control={form.control}
                        name="permissionIds"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel className="flex items-center gap-2">
                                    Permissões
                                </FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        {...field}
                                        value={(field.value ?? []) as string[]}
                                        onChange={(value) => field.onChange(value)}
                                        options={permissions.map((p) => ({
                                            label: p.name,
                                            value: p.id!,
                                            description: p.description,
                                            meta: {
                                                criticality: p.criticality,
                                                alias: p.alias,
                                            },
                                        }))}
                                        disabled={isLoadingPermissions}
                                        viewMode="cards"
                                        filterOption={(
                                            option,
                                            search,
                                            helpers,
                                        ) =>
                                            permissionFilter(
                                                option,
                                                search,
                                                helpers.normalize,
                                            )
                                        }
                                        renderOptionMeta={(option) => (
                                            <PermissionCriticality
                                                criticality={
                                                    option.meta?.criticality as
                                                        | string
                                                        | undefined
                                                }
                                            />
                                        )}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.CREATE]}>
                        <div className="flex justify-end mt-12">
                            <FormButtonSubmit>
                                <PlusIcon className="h-4 w-4" />
                                Criar Perfil
                            </FormButtonSubmit>
                        </div>
                    </Can>
                </FormSection>
            </div>
        </Form>
    );
}
