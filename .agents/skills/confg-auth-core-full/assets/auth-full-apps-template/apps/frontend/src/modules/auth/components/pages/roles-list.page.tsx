"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Badge,
    Button,
    DataTableContainer,
    Dialog,
    getErrorMessage,
    PageHeader,
    Table,
    TableAction,
    TableBody,
    TableCell,
    TableHead,
    TableHeaderCell,
    TableRow,
    TableSkeleton,
    toast,
    PaginationControls,
} from "@/shared";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRoleRegistration } from "../../data/hooks/use-role-registration.hook";
import { Can } from "../shared";
import { PERMISSIONS } from "__AUTH_PACKAGE_NAME__";
import { useState } from "react";

export function AuthRolesPage() {
    const router = useRouter();
    const { roles, isLoadingRoles, del, page, totalPages, total, goToPage } = useRoleRegistration();
    const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

    if (isLoadingRoles) return <TableSkeleton />;

    async function handleDelete() {
        if (!roleToDelete) return;
        try {
            await del(roleToDelete);
            setRoleToDelete(null);
            toast.success("Role deleted successfully");
        } catch (error) {
            toast.error("Failed to delete role", { description: getErrorMessage(error) });
        }
    }

    return (
        <>
            <PageHeader
                title="Perfis"
                subtitle="Lista de perfis cadastrados, prontos para edição."
                actions={
                    <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.CREATE]}>
                        <Button onClick={() => router.push("/admin/auth/roles/create")}>
                            Criar perfil
                        </Button>
                    </Can>
                }
            />

            <DataTableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell scope="col">Nome</TableHeaderCell>
                            <TableHeaderCell scope="col">Descrição</TableHeaderCell>
                            <TableHeaderCell scope="col">Permissões</TableHeaderCell>
                            <TableHeaderCell scope="col"><span className="sr-only">Editar</span></TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {roles.map((role) => {
                            const visiblePermissions = role.permissions?.slice(0, 3) ?? [];
                            const hiddenPermissions = role.permissions?.slice(3) ?? [];

                            return (
                                <TableRow key={role.id}>
                                    <TableCell>{role.name}</TableCell>
                                    <TableCell>{role.description}</TableCell>
                                    <TableCell className="w-[380px] whitespace-normal">
                                        <div className="flex flex-wrap gap-1.5">
                                            {visiblePermissions.length > 0 ? (
                                                <>
                                                    {visiblePermissions.map((p) => (
                                                        <Badge
                                                            key={p.id}
                                                            size="sm"
                                                            variant="secondary"
                                                            className="font-semibold"
                                                        >
                                                            {p.name}
                                                        </Badge>
                                                    ))}
                                                    {hiddenPermissions.length > 0 && (
                                                        <span title={hiddenPermissions.map((p) => p.name).join(", ")}>
                                                            <Badge
                                                                size="sm"
                                                                variant="default"
                                                                className="font-semibold"
                                                            >
                                                                +{hiddenPermissions.length}
                                                            </Badge>
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <Badge size="sm" variant="default">
                                                    Sem permissões
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableAction>
                                        <div className="flex gap-2 justify-end items-center">
                                            <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.READ]}>
                                                <Link href={`/admin/auth/roles/edit/${role.id}`} className="p-1 text-text-secondary transition-colors hover:text-text-primary">
                                                    <PencilIcon className="h-4 w-4" />
                                                    <span className="sr-only">, {role.name}</span>
                                                </Link>
                                            </Can>
                                            <Can requiredPermissions={[PERMISSIONS.AUTH.ROLE.DELETE]}>
                                                <button title="Deletar" onClick={() => setRoleToDelete(role.id!)} className="cursor-pointer p-1 text-status-error transition-colors hover:opacity-80">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </Can>
                                        </div>
                                    </TableAction>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </DataTableContainer>

            <Dialog isOpen={Boolean(roleToDelete)} type="delete" title="Excluir Perfil" onClose={() => setRoleToDelete(null)} onConfirm={handleDelete}>
                Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </Dialog>

            <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={total}
                totalLabel="perfis"
                onPageChange={goToPage}
            />
        </>
    );
}
