import { readSession } from "@web/lib/auth";import { redirect } from "next/navigation";import { getDashboardSummary } from "@web/lib/dashboard-repository";import CommandCenter from "@web/components/command-center";
export default async function Dashboard(){if(!await readSession())redirect("/login");return <CommandCenter initial={await getDashboardSummary()}/>}
