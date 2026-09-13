"use client";
import { UserDTO } from "__AUTH_PACKAGE_NAME__";
import {
    createContext,
    ReactNode,
    useCallback,
    useEffect,
    useState,
} from "react";
import * as userApi from "../api/user/user.service";
import { RegisterFormData } from "../schemas/auth";
import { CreateUserFormData } from "../schemas/user";

export interface UsersContextProps {
    users: UserDTO[];
    isLoading: boolean;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    getById(id: string): Promise<UserDTO | null>;
    create(data: RegisterFormData): Promise<void>;
    update(id: string, data: Partial<RegisterFormData>): Promise<void>;
    del(id: string): Promise<void>;
    assignRoles(userId: string, roleIds: string[]): Promise<void>;
    goToPage(page: number): void;
    searchByEmail(email: string): Promise<void>;
    clearSearch(): Promise<void>;
}

export const UserRegistrationContext = createContext<UsersContextProps>(
    {} as UsersContextProps,
);

export function UserRegistrationProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [users, setUsers] = useState<UserDTO[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(10);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);

    useEffect(() => {
        fetchUsers(page);
    }, [page]);

    const fetchUsers = useCallback(
        async (targetPage = page) => {
            try {
                setIsLoading(true);
                const response = await userApi.getUsers({
                    page: targetPage,
                    pageSize,
                });
                setUsers(response.data);
                setTotal(response.meta.total);
                setTotalPages(response.meta.totalPages);
                if (response.meta.page !== page) {
                    setPage(response.meta.page);
                }
            } catch (err) {
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [page, pageSize],
    );

    const getById = useCallback(
        async (id: string) => {
            const userInState = users.find((u) => u.id === id);
            if (userInState) {
                return userInState;
            }

            try {
                const user = await userApi.getUserById(id);
                return user;
            } catch (err) {
                console.error(`Failed to fetch user ${id}:`, err);
                return null;
            }
        },
        [users],
    );

    const create = useCallback(
        async (data: CreateUserFormData) => {
            try {
                await userApi.create(data);
                await fetchUsers(page);
            } catch (err) {
                throw err;
            }
        },
        [fetchUsers, page],
    );

    const update = useCallback(
        async (id: string, data: Partial<RegisterFormData>) => {
            try {
                await userApi.updateUser(id, data);
                await fetchUsers(page);
            } catch (err) {
                throw err;
            }
        },
        [fetchUsers, page],
    );

    const del = useCallback(
        async (id: string) => {
            try {
                await userApi.del(id);
                await fetchUsers(page);
            } catch (err) {
                throw err;
            }
        },
        [fetchUsers, page],
    );

    const assignRoles = useCallback(
        async (userId: string, roleIds: string[]) => {
            try {
                await userApi.assignRoles(userId, roleIds);
                await fetchUsers(page);
            } catch (err) {
                throw err;
            }
        },
        [fetchUsers, page],
    );

    const goToPage = useCallback(
        (nextPage: number) => {
            const maxPage = totalPages > 0 ? totalPages : 1;
            const safePage = Math.min(
                Math.max(1, Math.floor(nextPage)),
                maxPage,
            );
            if (safePage !== page) {
                setPage(safePage);
            }
        },
        [page, totalPages],
    );

    const searchByEmail = useCallback(async (email: string) => {
        try {
            setIsLoading(true);
            const user = await userApi.getUserByEmail(email);
            setUsers([user]);
            setPage(1);
            setTotal(1);
            setTotalPages(1);
        } catch (err) {
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearSearch = useCallback(async () => {
        if (page !== 1) {
            setPage(1);
            return;
        }
        await fetchUsers(1);
    }, [fetchUsers, page]);

    return (
        <UserRegistrationContext.Provider
            value={{
                users,
                isLoading,
                page,
                pageSize,
                total,
                totalPages,
                getById,
                create,
                update,
                del,
                assignRoles,
                goToPage,
                searchByEmail,
                clearSearch,
            }}
        >
            {children}
        </UserRegistrationContext.Provider>
    );
}
