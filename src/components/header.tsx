import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
      <Link href="/" className="text-sm font-semibold">
        Kirozeth AI
      </Link>
      <LogoutButton />
    </header>
  );
}
