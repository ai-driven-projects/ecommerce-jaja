import { Breadcrumb, PageHeader } from "@/shared";
import { ChangePasswordForm } from "../profile/change-password-form.component";
import { DeleteAccount } from "../profile/delete-account.component";
import { PersonalInformationForm } from "../profile/personal-information-form.component";

export function ProfilePage() {
    return (
        <div>
            <PageHeader
                title="Perfil"
                breadcrumb={
                    <Breadcrumb
                        items={[
                            {
                                name: "Início",
                                href: "/dashboard",
                                current: false,
                            },
                            { name: "Perfil", href: "/profile", current: true },
                        ]}
                    />
                }
            />
            <div className="rounded-[var(--radius-card)] border border-border-card bg-bg-card overflow-hidden divide-y divide-border-subtle">
                <PersonalInformationForm />
                <ChangePasswordForm />
                {/* <LogoutSessionsForm /> */}
                <DeleteAccount />
            </div>
        </div>
    );
}
