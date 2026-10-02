import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const s = await getSession();
  redirect(s ? homeFor(s.role) : "/login");
}
