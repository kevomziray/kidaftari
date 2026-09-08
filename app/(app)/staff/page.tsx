import { PageHeader } from "@/components/page-header";
import { CreateStaffForm, StaffAccessForm } from "@/components/auth/staff-forms";
import { requirePermission } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function StaffPage() {
  const actor = await requirePermission("manage_staff");
  const staff = await prisma.user.findMany({
    where: { businessId: actor.business.id, role: "STAFF" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      active: true,
      canReverseTransactions: true,
    },
  });
  return (
    <>
      <PageHeader title="Staff" description="Give your team the access they need." />
      <div className="content-grid">
        <section className="card">
          <CreateStaffForm />
        </section>
        <section className="card">
          <h2>Your staff</h2>
          {staff.length ? (
            staff.map((member) => <StaffAccessForm key={member.id} staff={member} />)
          ) : (
            <p>No staff added yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
