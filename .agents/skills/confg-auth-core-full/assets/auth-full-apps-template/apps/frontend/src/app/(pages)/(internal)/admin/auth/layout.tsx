"use client";

import {
  RoleRegistrationProvider,
  UserRegistrationProvider,
} from "@/modules/auth";
import { InternalShell } from "@/shared";

export default function AuthLayout(props: { children: React.ReactNode }) {
  return (
    <InternalShell>
      <RoleRegistrationProvider>
        <UserRegistrationProvider>
          {props.children}
        </UserRegistrationProvider>
      </RoleRegistrationProvider>
    </InternalShell>
  );
}
