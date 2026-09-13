import { useContext } from "react";
import { UserRegistrationContext } from "../contexts/user-registration.context";

export function useUserRegistration() {
  const context = useContext(UserRegistrationContext);
  if (context === undefined) {
    throw new Error(
      "useUserRegistration must be used within an UserRegistrationProvider",
    );
  }
  return context;
}
