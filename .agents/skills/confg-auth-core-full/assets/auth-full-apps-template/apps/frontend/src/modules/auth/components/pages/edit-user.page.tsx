"use client";
import {
    UserIcon,
    PencilIcon,
    EnvelopeIcon,
    IdentificationIcon,
} from "@heroicons/react/24/outline";
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
    MultiSelect,
    ItemNotFound,
    FormSection,
    v,
} from "@/shared";
import { toast } from "sonner";
import { useUserRegistration } from "../../data";
import { useEffect, useState } from "react";
import { EditUserFormData, editUserSchema } from "../../data/schemas/user";
import { PERMISSIONS, RoleDTO, UserDTO } from "__AUTH_PACKAGE_NAME__";
import { Can } from "../shared";
import { getAllRoles } from "../../data/api/role/role.service";

export function EditUserPage({ userId }: { userId: string }) {
    const { getById, update, assignRoles } = useUserRegistration();
    const [roles, setRoles] = useState<RoleDTO[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [user, setUser] = useState<UserDTO | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);

    const form = useForm<EditUserFormData>({
        resolver: v.resolver(editUserSchema),
        defaultValues: {
            name: "",
            roleIds: [],
        },
    });

    useEffect(() => {
        async function fetchUser() {
            if (userId) {
                setIsLoadingUser(true);
                const fetchedUser = await getById(userId);
                if (fetchedUser) {
                    setUser(fetchedUser);
                    form.reset({
                        id: fetchedUser.id ?? "",
                        email: fetchedUser.email ?? "",
                        roleIds: fetchedUser.roles.map((r) => r.id),
                        name: fetchedUser.name,
                    });
                }
                setIsLoadingUser(false);
            }
        }
        fetchUser();
    }, [userId, getById, form]);

    useEffect(() => {
        async function fetchRoles() {
            try {
                setIsLoadingRoles(true);
                const allRoles = await getAllRoles();
                setRoles(allRoles);
            } catch (error) {
                toast.error("Failed to load roles", {
                    description: getErrorMessage(error),
                });
            } finally {
                setIsLoadingRoles(false);
            }
        }

        fetchRoles();
    }, []);

    async function onSubmitUserData(data: { name: string }) {
        if (!userId) {
            toast.error("User ID not provided for update.");
            return;
        }
        try {
            await update(userId, { name: data.name });
            toast.success("Dados do usuário atualizados com sucesso");
        } catch (error) {
            toast.error("Failed to update user", {
                description: getErrorMessage(error),
            });
        }
    }

    async function onSubmitRoles(roleIds: string[]) {
        if (!userId) {
            toast.error("User ID not provided for update.");
            return;
        }
        try {
            await assignRoles(userId, roleIds);
            toast.success("Perfis atualizados com sucesso");
        } catch (error) {
            toast.error("Failed to update roles", {
                description: getErrorMessage(error),
            });
        }
    }

    if (isLoadingUser) {
        return (
            <div className="flex items-center justify-center min-h-100">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-medium text-gray-400">
                        Loading user data...
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <ItemNotFound
                icon={UserIcon}
                title="User Not Found"
                description="Usuário não encontrado, por favor verifique o id do usuário."
            />
        );
    }

    const userData = form.watch("name");
    const roleIds = form.watch("roleIds");

    return (
        <div className="pb-10 space-t-6">
            <Form
                form={form}
                onSubmit={form.handleSubmit(() =>
                    onSubmitUserData({ name: userData }),
                )}
            >
                <FormSection
                    title="Editar Usuário"
                    description="Atualize as informações do perfil do usuário."
                >
                    <div className="flex flex-col gap-6">
                        <div className="sm:col-span-2">
                            <FormLabel className="flex items-center gap-2">
                                <IdentificationIcon className="h-4 w-4 text-gray-400" />
                                ID do Usuário
                            </FormLabel>
                            <Input
                                value={user.id}
                                readOnly
                                className="mt-2 read-only:bg-gray-800/50 read-only:brightness-75 read-only:cursor-not-allowed read-only:text-gray-400 read-only:border-gray-700 font-mono text-sm transition-all duration-200"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                O id é único e não pode ser alterado.
                            </p>
                        </div>

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-gray-400" />
                                        Nome Completo
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter full name"
                                            autoComplete="name"
                                            {...field}
                                            className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="sm:col-span-2">
                            <FormLabel className="flex items-center gap-2">
                                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                Endereço de Email
                            </FormLabel>
                            <Input
                                type="email"
                                value={user.email}
                                readOnly
                                className="mt-2 read-only:bg-gray-800/50 read-only:brightness-75 read-only:cursor-not-allowed read-only:text-gray-400 read-only:border-gray-700 transition-all duration-200"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                O endereço de email não pode ser modificado.
                            </p>
                        </div>

                        <Can
                            requiredPermissions={[PERMISSIONS.AUTH.USER.UPDATE]}
                        >
                            <div className="flex justify-end mt-4">
                                <FormButtonSubmit>
                                    <PencilIcon className="h-4 w-4" />
                                    Salvar Alterações
                                </FormButtonSubmit>
                            </div>
                        </Can>
                    </div>
                </FormSection>
            </Form>

            <Form
                form={form}
                onSubmit={form.handleSubmit(() => onSubmitRoles(roleIds))}
            >
                <FormSection
                    title="Perfis"
                    description="Adicione ou remova perfis para o usuário"
                >
                    <FormField
                        name="roleIds"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Perfis</FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        {...field}
                                        options={roles.map((p) => ({
                                            label: p.name,
                                            value: p.id!,
                                            description: p.description,
                                        }))}
                                        disabled={isLoadingRoles}
                                        viewMode="cards"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Can requiredPermissions={[PERMISSIONS.AUTH.USER.UPDATE]}>
                        <div className="flex justify-end mt-4">
                            <FormButtonSubmit>
                                <PencilIcon className="h-4 w-4" />
                                Salvar Alterações
                            </FormButtonSubmit>
                        </div>
                    </Can>
                </FormSection>
            </Form>
        </div>
    );
}
