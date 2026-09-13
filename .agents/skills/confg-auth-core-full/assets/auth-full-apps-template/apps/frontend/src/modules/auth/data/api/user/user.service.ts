import { api } from "@/shared";
import {
  UpdateProfileFormData,
  ChangePasswordFormData,
  CreateUserFormData,
} from "../../schemas/user";
import { FindAllUsersInDTO, FindAllUsersOutDTO, UserDTO } from "__AUTH_PACKAGE_NAME__";

export async function updateProfile(
  data: UpdateProfileFormData,
): Promise<void> {
  const response = await api.patch<void>("/auth/profile", data);
  return response.data;
}

export async function changePassword(
  data: ChangePasswordFormData,
): Promise<void> {
  await api.patch("/auth/password/change", data);
}

export async function getUsers({
  page,
  pageSize,
}: FindAllUsersInDTO): Promise<FindAllUsersOutDTO> {
  const response = await api.get<FindAllUsersOutDTO>("/auth/users", {
    params: { page, pageSize },
  });
  return response.data;
}

export async function getUserById(id: string): Promise<UserDTO> {
  const response = await api.get<UserDTO>(`/auth/users/${id}`);
  return response.data;
}

export async function getUserByEmail(email: string): Promise<UserDTO> {
  const response = await api.get<UserDTO>("/auth/users/by-email", {
    params: { email },
  });
  return response.data;
}

export async function updateUser(
  id: string,
  data: Partial<CreateUserFormData>,
): Promise<void> {
  const response = await api.patch<void>(`/auth/users/${id}`, data);
  return response.data;
}

export async function del(id: string) {
  await api.delete(`/auth/users/${id}`);
}

export async function deleteOwnAccount(): Promise<void> {
  await api.delete("/auth/profile");
}

export async function create(data: CreateUserFormData) {
  await api.post("/auth/user/create", data);
}

export async function assignRoles(userId: string, roleIds: string[]): Promise<void> {
  await api.patch(`/auth/users/${userId}/roles`, { roleIds });
}
