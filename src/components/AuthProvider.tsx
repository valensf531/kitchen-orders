import { headers } from "next/headers";

export async function AuthProvider({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const header_url = headersList.get('x-url') || "";
  console.log('AuthProvider - header_url:', header_url);

  return <>{children}</>;
}
