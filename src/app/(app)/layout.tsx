import { redirect } from 'next/navigation';
import { getSession } from '../../lib/auth-server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>{children}</>
  )
}