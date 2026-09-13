"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  getRoles as apiGetRoles,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
  getPermissions as apiGetPermissions,
} from "../api/role/role.service";
import { CreateRoleFormData, EditRoleFormData } from "../schemas/role";
import { RoleDTO, PermissionDTO } from "__AUTH_PACKAGE_NAME__";

export interface RolesContextProps {
  roles: RoleDTO[];
  permissions: PermissionDTO[];
  isLoadingRoles: boolean;
  isLoadingPermissions: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  getById(id: string): RoleDTO | null;
  create(data: CreateRoleFormData): Promise<void>;
  update(id: string, data: Partial<EditRoleFormData>): Promise<void>;
  del(id: string): Promise<void>;
  getPermissionsList(): Promise<PermissionDTO[]>;
  goToPage(page: number): void;
}

export const RolesContext = createContext<RolesContextProps>(
  {} as RolesContextProps,
);

export function RoleRegistrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionDTO[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(false);
  const [isLoadingPermissions, setIsLoadingPermissions] =
    useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  useEffect(() => {
    fetchRoles(page);
    fetchPermissions();
  }, [page]);

  const fetchRoles = useCallback(async (targetPage = page) => {
    try {
      setIsLoadingRoles(true);
      const response = await apiGetRoles({ page: targetPage, pageSize });
      setRoles(response.data);
      setTotal(response.meta.total);
      setTotalPages(response.meta.totalPages);
      if (response.meta.page !== page) {
        setPage(response.meta.page);
      }
    } catch (err) {
      throw err;
    } finally {
      setIsLoadingRoles(false);
    }
  }, [page, pageSize]);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoadingPermissions(true);
      const permissions = await apiGetPermissions();
      setPermissions(permissions);
    } catch (err) {
      throw err;
    } finally {
      setIsLoadingPermissions(false);
    }
  }, []);

  const getById = useCallback(
    (id: string) => {
      if (!roles.length) return null;
      return roles.find((r) => r.id === id) ?? null;
    },
    [roles],
  );

  const create = useCallback(
    async (data: CreateRoleFormData) => {
      try {
        await apiCreateRole(data);
        await fetchRoles(page);
      } catch (err) {
        throw err;
      }
    },
    [fetchRoles, page],
  );

  const update = useCallback(
    async (id: string, data: Partial<EditRoleFormData>) => {
      try {
        await apiUpdateRole(id, data);
        await fetchRoles(page);
      } catch (err) {
        throw err;
      }
    },
    [fetchRoles, page],
  );

  const del = useCallback(
    async (id: string) => {
      try {
        await apiDeleteRole(id);
        await fetchRoles(page);
      } catch (err) {
        throw err;
      }
    },
    [fetchRoles, page],
  );

  const getPermissionsList = useCallback(async () => {
    try {
      const permissions = await apiGetPermissions();
      return permissions;
    } catch (err) {
      throw err;
    }
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      const maxPage = totalPages > 0 ? totalPages : 1;
      const safePage = Math.min(Math.max(1, Math.floor(nextPage)), maxPage);
      if (safePage !== page) {
        setPage(safePage);
      }
    },
    [page, totalPages],
  );

  return (
    <RolesContext.Provider
      value={{
        roles,
        permissions,
        isLoadingRoles,
        isLoadingPermissions,
        page,
        pageSize,
        total,
        totalPages,
        getById,
        create,
        update,
        del,
        getPermissionsList,
        goToPage,
      }}
    >
      {children}
    </RolesContext.Provider>
  );
}
