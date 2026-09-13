"use client";

import { useForm } from "react-hook-form";
import {
    Form,
    FormButtonSubmit,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    v,
} from "@/shared";

import { StrongPassword } from "__SHARED_PACKAGE_NAME__";

const logoutSessionsSchema = v.defineObject({
    password: StrongPassword,
});

type LogoutSessionsFormData = v.infer<typeof logoutSessionsSchema>;

export function LogoutSessionsForm() {
    const form = useForm<LogoutSessionsFormData>({
        resolver: v.resolver(logoutSessionsSchema),
    });

    const onSubmit = (data: LogoutSessionsFormData) => {
        console.log(data);
        // TODO: Handle logout from other sessions
    };

    return (
        <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
                <h2 className="text-base/7 font-semibold text-text-primary">
                    Encerrar outras sessões
                </h2>
                <p className="mt-1 text-sm/6 text-text-muted">
                    Insira sua senha para confirmar que deseja encerrar suas
                    sessões em todos os outros dispositivos.
                </p>
            </div>

            <Form
                form={form}
                className="md:col-span-2"
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                    <div className="col-span-full">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sua senha</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            autoComplete="current-password"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="mt-8 flex">
                    <FormButtonSubmit>Sair de todas as seções</FormButtonSubmit>
                </div>
            </Form>
        </div>
    );
}
