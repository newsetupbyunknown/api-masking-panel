import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAllApis, getLogs } from "@/lib/db";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const isAdmin = await getSession();
  if (!isAdmin) {
    redirect("/login");
  }

  const apis = await getAllApis();
  const logs = await getLogs(50);

  // Strip real keys
  const safeApis = apis.map(({ realApiKey, ...rest }) => rest);

  return <DashboardClient initialApis={safeApis} initialLogs={logs} />;
}
