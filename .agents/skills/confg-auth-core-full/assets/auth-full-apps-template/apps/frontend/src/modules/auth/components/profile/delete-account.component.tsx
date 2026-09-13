"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, getErrorMessage } from "@/shared";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth";
import { deleteOwnAccount } from "../../data/api/user/user.service";

export function DeleteAccount() {
    const router = useRouter();
    const { logout } = useAuth();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (isDeleting) {
            return;
        }

        try {
            setIsDeleting(true);
            await deleteOwnAccount();
            logout();
            toast.success("Conta excluida com sucesso");
            router.push("/auth/sign-in");
        } catch (error) {
            toast.error("Falha ao excluir conta", {
                description: getErrorMessage(error),
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
                <h2 className="text-base/7 font-semibold text-white">
                    Excluir conta
                </h2>
                <p className="mt-1 text-sm/6 text-gray-400">
                    Nao deseja mais usar nosso servico? Voce pode solicitar a
                    exclusao da sua conta aqui. Esta acao e irreversivel.
                </p>
            </div>

            <div className="flex flex-col items-start gap-4 md:col-span-2">
                <button
                    type="button"
                    className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-400"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeleting}
                >
                    {isDeleting ? "Excluindo..." : "Excluir minha conta"}
                </button>
            </div>

            <Dialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                title="Excluir conta"
                type="delete"
                confirmText="Excluir conta"
                cancelText="Cancelar"
                onConfirm={handleDelete}
            >
                Esta ação é irreversivel. Deseja realmente excluir sua conta?
            </Dialog>
        </div>
    );
}
