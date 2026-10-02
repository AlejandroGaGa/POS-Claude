import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { plain } from "@/lib/serialize";
import { Page, PageHeader, Pager } from "@/components/ui";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import UsersManager, { type UserRow } from "@/components/UsersManager";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const me = await requirePage("users:manage");
  await connectDB();
  const page = parsePage((await searchParams).pagina);
  const { rows: users, total } = await paginate(User.find().sort({ active: -1, name: 1 }), User.countDocuments(), page);
  return (
    <Page>
      <PageHeader title="Usuarios" subtitle="Quién entra al sistema y qué puede hacer." />
      <UsersManager users={plain<UserRow[]>(users)} meId={me.id} total={total} />
      {total > PAGE_SIZE && <Pager page={page} pageSize={PAGE_SIZE} total={total} path="/usuarios" query={{}} />}
    </Page>
  );
}
