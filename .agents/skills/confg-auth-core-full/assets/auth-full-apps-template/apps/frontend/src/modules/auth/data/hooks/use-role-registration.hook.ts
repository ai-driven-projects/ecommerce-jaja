import { useContext } from "react";
import { RolesContext } from "../contexts/role-registration.context";

export function useRoleRegistration() {
  const context = useContext(RolesContext);

  if (!context) {
    throw new Error(
      "useRoleRegistration must be used within a RolesProvider",
    );
  }

  return context;
}
