import { EditUserPage as AuthEditUserPage } from "@/modules/auth";

export default async function UserEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <AuthEditUserPage userId={id} />;
}
