import { api } from "@/shared";
import { CreateRoleFormData, EditRoleFormData } from "../../schemas/role";
import {
  FindAllRolesInDTO,
  FindAllRolesOutDTO,
  PermissionDTO,
  RoleDTO,
} from "__AUTH_PACKAGE_NAME__";

export async function getRoles({
  page,
  pageSize,
  all,
}: FindAllRolesInDTO): Promise<FindAllRolesOutDTO> {
  const response = await api.get<FindAllRolesOutDTO>("/roles", {
    params: { page, pageSize, all },
  });
  return response.data;
}

export async function getAllRoles(): Promise<RoleDTO[]> {
  const response = await getRoles({ page: 1, pageSize: 10, all: true });
  return response.data;
}

export async function createRole(data: CreateRoleFormData): Promise<void> {
  await api.post("/roles", data);
}

export async function updateRole(
  id: string,
  data: Partial<EditRoleFormData>,
): Promise<RoleDTO> {
  const response = await api.patch<RoleDTO>(`/roles/${id}`, data);
  return response.data;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}

export async function getPermissions(): Promise<PermissionDTO[]> {
  const response = await api.get<PermissionDTO[]>("/roles/permissions");
  return response.data;
}
