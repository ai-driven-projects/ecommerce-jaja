"use client";

import {
    Cog6ToothIcon,
    UserGroupIcon,
    DocumentCheckIcon,
    ArrowLeftCircleIcon,
} from "@heroicons/react/24/outline";
import { PermissionDTO, PERMISSIONS } from "__AUTH_PACKAGE_NAME__";
import { classNames } from "@/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "../shared";

interface NavigationItem {
    name: string;
    href: string;
    icon: React.ElementType;
    current: boolean;
    requiredPermissions: PermissionDTO[];
}

export function AuthMenu() {
    const pathname = usePathname();

    const navigation: NavigationItem[] = [
        {
            name: "Auth Module",
            href: "/admin/auth",
            icon: Cog6ToothIcon,
            current: pathname === "/admin/auth",
            requiredPermissions: [PERMISSIONS.AUTH.MODULE.VIEW],
        },
        {
            name: "Usuarios",
            href: "/admin/auth/users",
            icon: UserGroupIcon,
            current: pathname?.startsWith("/admin/auth/users"),
            requiredPermissions: [PERMISSIONS.AUTH.USER.VIEW],
        },
        {
            name: "Perfis",
            href: "/admin/auth/roles",
            icon: DocumentCheckIcon,
            current: pathname?.startsWith("/admin/auth/roles"),
            requiredPermissions: [PERMISSIONS.AUTH.ROLE.VIEW],
        },
        {
            name: "Voltar",
            href: "/dashboard",
            icon: ArrowLeftCircleIcon,
            current: pathname?.startsWith("/dashboard"),
            requiredPermissions: [PERMISSIONS.AUTH.MODULE.VIEW],
        },
    ];

    return (
        <nav className="relative flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                    <ul role="list" className="-mx-2 space-y-1">
                        {navigation.map((item) => (
                            <Can
                                key={item.name}
                                requiredPermissions={item.requiredPermissions}
                            >
                                <li>
                                    <Link
                                        href={item.href}
                                        className={classNames(
                                            item.current
                                                ? "bg-white/5 text-white"
                                                : "text-gray-400 hover:bg-white/5 hover:text-white",
                                            "group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold",
                                        )}
                                    >
                                        <item.icon
                                            aria-hidden="true"
                                            className={classNames(
                                                item.current
                                                    ? "text-white"
                                                    : "text-gray-400 group-hover:text-white",
                                                "size-6 shrink-0",
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                </li>
                            </Can>
                        ))}
                    </ul>
                </li>
            </ul>
        </nav>
    );
}
