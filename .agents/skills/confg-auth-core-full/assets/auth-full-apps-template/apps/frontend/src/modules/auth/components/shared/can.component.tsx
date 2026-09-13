import { PermissionDTO } from "__AUTH_PACKAGE_NAME__";
import { ReactNode } from "react";
import { useAuth } from "../../data";

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermissions: PermissionDTO[];
}
export function Can(props: PermissionGuardProps) {
  const { hasPermission } = useAuth();

  const canView = hasPermission(props.requiredPermissions);
  if (!canView) return null;

  return props.children;
}
