"use client";
import Link from "next/link";
import {
    Table, TableAction, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TableSkeleton,
    Badge, Breadcrumb, Button, DataTableContainer, Dialog, toast, getErrorMessage, PageHeader, PaginationControls, Input,
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormButtonSubmit, v,
} from "@/shared";
import { MagnifyingGlassIcon, PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useUserRegistration, createUserSchema, CreateUserFormData } from "../../data";
import Image from "next/image";
import { useState } from "react";
import { Can } from "../shared";
import { PERMISSIONS } from "__AUTH_PACKAGE_NAME__";
import { useForm } from "react-hook-form";
import {
    Dialog as PrimitiveDialog,
    DialogPanel,
    DialogTitle,
} from "@headlessui/react";

export function UserListPage() {
    const { users, isLoading, del, create, page, totalPages, total, goToPage, searchByEmail, clearSearch } = useUserRegistration();
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [searchEmail, setSearchEmail] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    const createForm = useForm<CreateUserFormData>({
        resolver: v.resolver(createUserSchema),
        defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    });

    if (isLoading) return <TableSkeleton />;

    async function handleDelete() {
        if (!userToDelete) return;
        try {
            await del(userToDelete);
            setUserToDelete(null);
            toast.success("Usuário excluído com sucesso");
        } catch (error) {
            toast.error("Falha ao excluir usuário", { description: getErrorMessage(error) });
        }
    }

    async function handleSearchByEmail() {
        if (!searchEmail.trim()) { await clearSearch(); return; }
        try {
            await searchByEmail(searchEmail.trim().toLowerCase());
        } catch (error) {
            toast.error("Usuário não encontrado", { description: getErrorMessage(error) });
        }
    }

    async function handleClearSearch() {
        setSearchEmail("");
        try {
            await clearSearch();
        } catch (error) {
            toast.error("Falha ao recarregar usuários", { description: getErrorMessage(error) });
        }
    }

    async function handleCreateUser(data: CreateUserFormData) {
        try {
            await create(data);
            toast.success("Usuário criado com sucesso");
            setShowCreateDialog(false);
            createForm.reset();
        } catch (error) {
            toast.error("Falha ao criar usuário", { description: getErrorMessage(error) });
        }
    }

    return (
        <>
            <PageHeader
                title="Usuários"
                subtitle="Lista de usuários cadastrados, prontos para edição."
                breadcrumb={
                    <Breadcrumb
                        items={[
                            { name: "Início", href: "/dashboard", current: false },
                            { name: "Auth", href: "/admin/auth", current: false },
                            { name: "Usuários", href: "/admin/auth/users", current: true },
                        ]}
                    />
                }
                actions={
                    <Can requiredPermissions={[PERMISSIONS.AUTH.USER.CREATE]}>
                        <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setShowCreateDialog(true)}>
                            Novo usuário
                        </Button>
                    </Can>
                }
            />

            <DataTableContainer>
                <div className="p-4 flex flex-col gap-3.5">
                    <h3 className="text-[15px] font-semibold text-text-secondary">Buscar por e-mail</h3>
                    <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={async (e) => { e.preventDefault(); await handleSearchByEmail(); }}>
                        <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-input bg-bg-input px-3.5 py-2.5">
                            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
                            <input
                                value={searchEmail}
                                onChange={(e) => setSearchEmail(e.target.value)}
                                placeholder="exemplo@dominio.com"
                                className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none w-full"
                            />
                        </div>
                        <Button type="submit" size="sm" className="w-full sm:w-auto">
                            Buscar
                        </Button>
                        <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleClearSearch}>
                            Limpar
                        </Button>
                    </form>
                </div>
            </DataTableContainer>

            <DataTableContainer className="mt-6">
                <div className="p-4 flex flex-col gap-3.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-heading text-lg font-semibold text-text-primary">Usuários</h3>
                        <span className="text-xs text-text-muted">Total de usuários: {total}</span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border-card bg-bg-card-hover/50">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell scope="col">Nome</TableHeaderCell>
                                    <TableHeaderCell scope="col" className="w-[280px]">Perfis</TableHeaderCell>
                                    <TableHeaderCell scope="col" className="w-[140px] text-right">Ações</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex gap-2.5 items-center">
                                                <Image
                                                    alt={user.name}
                                                    src={
                                                        user.avatarUrl ??
                                                        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                                                    }
                                                    className="size-[30px] flex-none rounded-full bg-bg-card-hover object-cover"
                                                    width={60}
                                                    height={60}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-text-primary">{user.name}</span>
                                                    <span className="text-xs text-text-muted">{user.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="space-x-1.5 w-[280px]">
                                            {user.roles?.map((r) => (
                                                <Badge key={r.id} size="sm" variant="secondary" className="font-semibold">{r.name}</Badge>
                                            ))}
                                        </TableCell>
                                        <TableAction className="w-[140px]">
                                            <div className="flex gap-3.5 justify-end items-center">
                                                <Can requiredPermissions={[PERMISSIONS.AUTH.USER.READ]}>
                                                    <Link title="Editar" href={`/admin/auth/users/edit/${user.id}`} className="text-text-secondary transition-colors hover:text-text-primary">
                                                        <PencilIcon className="w-4 h-4" />
                                                        <span className="sr-only">, {user.name}</span>
                                                    </Link>
                                                </Can>
                                                <Can requiredPermissions={[PERMISSIONS.AUTH.USER.DELETE]}>
                                                    <button title="Deletar" onClick={() => setUserToDelete(user.id!)} className="cursor-pointer text-status-error transition-colors hover:opacity-80">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </Can>
                                            </div>
                                        </TableAction>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-text-muted">Mostrando {users.length} usuários</span>
                        <PaginationControls page={page} totalPages={totalPages} totalItems={total} totalLabel="usuários" onPageChange={goToPage} />
                    </div>
                </div>
            </DataTableContainer>

            <Dialog isOpen={Boolean(userToDelete)} type="delete" title="Excluir Usuário" onClose={() => setUserToDelete(null)} onConfirm={handleDelete}>
                Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </Dialog>

            <PrimitiveDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/60" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <DialogPanel className="w-full max-w-md rounded-2xl border border-border-card bg-bg-card p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-5">
                            <DialogTitle className="font-heading text-lg font-bold text-text-primary">
                                Novo Usuário
                            </DialogTitle>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="cursor-pointer rounded-md p-1 hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <Form form={createForm} onSubmit={createForm.handleSubmit(handleCreateUser)}>
                            <div className="flex flex-col gap-4">
                                <FormField
                                    control={createForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nome completo" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={createForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>E-mail</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="email@exemplo.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={createForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Senha</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={createForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirmar Senha</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="Repita a senha" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { setShowCreateDialog(false); createForm.reset(); }}
                                        className="cursor-pointer rounded-[10px] border border-border-input bg-bg-input px-4 py-2.5 text-xs font-semibold text-text-secondary transition-all hover:bg-bg-card-hover"
                                    >
                                        Cancelar
                                    </button>
                                    <FormButtonSubmit>
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        Criar Usuário
                                    </FormButtonSubmit>
                                </div>
                            </div>
                        </Form>
                    </DialogPanel>
                </div>
            </PrimitiveDialog>
        </>
    );
}
