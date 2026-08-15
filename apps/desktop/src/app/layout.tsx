export const metadata = {
  title: "CodeSentinel",
  description: "Local-first secure source code analysis & risk assessment",
};

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/projects" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              CodeSentinel
              <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                risk assessment platform
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                Projects
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}