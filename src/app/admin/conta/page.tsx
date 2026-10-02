import type { Metadata } from "next";
import { listAdmins } from "@/modules/administration/application/administration-service";
import { AccountActions } from "@/modules/administration/presentation/components/account-actions";
import { CreateAdminForm } from "@/modules/administration/presentation/components/create-admin-form";
import { requireRole } from "@/modules/identity/application/current-actor";
import { ChangePasswordForm } from "@/modules/identity/presentation/components/change-password-form";
import { formatDate } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AdminAccountPage() {
  const actor = await requireRole("ADMIN");
  const admins = await listAdmins(actor);

  return (
    <>
      <PageHeader title="Minha conta" description="Sua senha e a equipe administrativa da clínica." />
      <div className="space-y-6">
        <Panel title="Senha de acesso">
          <ChangePasswordForm />
        </Panel>
        <Panel
          title="Equipe administrativa"
          description="Contas com acesso a esta área (ex.: recepção). Elas não acessam prontuários nem dados de saúde."
        >
          <ul className="mb-6 divide-y divide-linha">
            {admins.map((admin) => (
              <li key={admin.userId} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {admin.name} {admin.isMe && <Badge tone="violet">você</Badge>} {!admin.active && <Badge tone="red">desativada</Badge>}{" "}
                    {admin.active && admin.pendingInvite && <Badge tone="yellow">convite pendente</Badge>}
                  </p>
                  <p className="text-sm text-pedra">
                    {admin.email}
                    {admin.lastLoginAt ? `, último acesso em ${formatDate(admin.lastLoginAt)}` : ""}
                  </p>
                </div>
                {!admin.isMe && <AccountActions userId={admin.userId} active={admin.active} name={admin.name} pendingInvite={admin.pendingInvite} />}
              </li>
            ))}
          </ul>
          <h3 className="mb-3 font-bold">Nova conta administrativa</h3>
          <CreateAdminForm />
        </Panel>
      </div>
    </>
  );
}
