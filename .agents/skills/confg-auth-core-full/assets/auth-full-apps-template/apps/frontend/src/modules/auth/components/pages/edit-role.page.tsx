"use client";

import { PencilIcon } from "@heroicons/react/24/outline";
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
import { toast } from "sonner";
import { useRoleRegistration } from "../../data";
import { useEffect, useState } from "react";
import { EditRoleFormData, editRoleSchema } from "../../data/schemas/role";
import { PERMISSIONS, RoleDTO } from "__AUTH_PACKAGE_NAME__";
import { Can, PermissionCriticality } from "../shared";

export function EditRolePage({ roleId }: { roleId: string }) {
    const { getById, update, permissions, isLoadingPermissions } =
        useRoleRegistration();
    const [role, setRole] = useState<RoleDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<EditRoleFormData>({
        resolver: v.resolver(editRoleSchema),
        defaultValues: {
            name: "",
            description: "",
            permissionIds: [],
        },
    });

    useEffect(() => {
        (async function () {
            if (roleId) {
                setIsLoading(true);
                const fetchedRole = getById(roleId);
                if (fetchedRole) {
                    setRole(fetchedRole);
                    form.reset({
                        id: fetchedRole.id,
                        name: fetchedRole.name,
                        description: fetchedRole.description,
                        permissionIds: fetchedRole.permissions.map((p) => p.id),
                    });
                }
                setIsLoading(false);
            }
        })();
    }, [roleId, getById, form]);

    async function onSubmit(data: EditRoleFormData) {
        if (!roleId) {
            toast.error("Role ID not provided for update.");
            return;
        }
        try {
            await update(roleId, data);
            toast.success("Role updated successfully");
        } catch (error) {
            toast.error("Failed to update role", {
                description: getErrorMessage(error),
            });
        }
    }

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!role) {
        return <div>Role not found</div>;
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
                    title="Editar Perfil"
                    description="Atualize as informações do perfil e suas permissões."
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
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.UPDATE]}>
                        <div className="flex justify-end mt-12">
                            <FormButtonSubmit>
                                <PencilIcon className="h-4 w-4" />
                                Salvar Alterações
                            </FormButtonSubmit>
                        </div>
                    </Can>
                </FormSection>

                <FormSection
                    title="Permissões"
                    description="Edite as permissões do perfil"
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
                    <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.UPDATE]}>
                        <div className="flex justify-end mt-12">
                            <FormButtonSubmit>
                                <PencilIcon className="h-4 w-4" />
                                Salvar Alterações
                            </FormButtonSubmit>
                        </div>
                    </Can>
                </FormSection>
            </div>
        </Form>
    );
}
