"use client";

import {
  UserIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
  FormMessage,
  getErrorMessage,
  FormButtonSubmit,
  FormSection,
  v,
} from "@/shared";
import { CreateUserFormData, createUserSchema } from "../../data/schemas/user";
import { toast } from "sonner";
import { useUserRegistration } from "../../data";
import { Can } from "../shared";
import { PERMISSIONS } from "__AUTH_PACKAGE_NAME__";

export function CreateUserPage() {
  const { create } = useUserRegistration();
  const form = useForm<CreateUserFormData>({
    resolver: v.resolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: CreateUserFormData) {
    try {
      await create(data);
      toast.success("User created successfully");
      form.reset();
    } catch (error) {
      toast.error("Failed to create user", {
        description: getErrorMessage(error),
      });
    }
  }

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
      <div className="pb-10">
        <FormSection
          title="Cria uauário"
          description="Aqui você cria novos usuários e define o que ele pode fazer dentro do sistema."
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  Nome Completo
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter full name"
                    autoComplete="name"
                    {...field}
                    className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Endereço de Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    autoComplete="email"
                    {...field}
                    className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          title="Senha"
          description="Defina a senha do usuário"
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <LockClosedIcon className="h-4 w-4 text-gray-400" />
                  Senha
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    {...field}
                    className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <CheckBadgeIcon className="h-4 w-4 text-gray-400" />
                  Confirmação de Senha
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...field}
                    className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Can requiredPermissions={[PERMISSIONS.AUTH.USER.CREATE]}>
            <div className="flex justify-end mt-12">
              <FormButtonSubmit>
                <PencilIcon className="h-4 w-4" />
                Criar usuário
              </FormButtonSubmit>
            </div>
          </Can>
        </FormSection>
      </div>
    </Form>
  );
}
