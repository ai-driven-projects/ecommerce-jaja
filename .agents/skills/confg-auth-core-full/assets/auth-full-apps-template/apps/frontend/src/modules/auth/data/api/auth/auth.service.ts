import { api } from "@/shared";
import { LoginFormData, RegisterFormData } from "../../schemas/auth";
import { UserDTO, GetAuthDashboardOverviewOut } from "__AUTH_PACKAGE_NAME__";

export async function login(data: LoginFormData) {
  const response = await api.post<{
    access_token: string;
  }>("/auth/login", data);
  return response.data;
}

export async function register(data: RegisterFormData) {
  await api.post("/auth/register", data);
}

export async function getMe() {
  const response = await api.get<UserDTO>("/auth/me");
  return response.data;
}

export async function getAuthOverview() {
  const response = await api.get<GetAuthDashboardOverviewOut>("/auth/overview");
  return response.data;
}
