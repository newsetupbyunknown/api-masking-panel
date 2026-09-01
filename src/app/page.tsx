import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const isLoggedIn = await getSession();
  if (isLoggedIn) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
