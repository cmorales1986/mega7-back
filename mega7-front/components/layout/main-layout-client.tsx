"use client";

import Sidebar from "@/components/layout/sidebar";
import Navbar from "@/components/layout/navbar";
import { FloatingReportsButton } from "@/components/ui/floating-reports-button";
import { FloatingPriceButton } from "@/components/ui/floating-price-button";
import { AuthProvider } from "@/contexts/auth-context";

export default function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex h-screen bg-gray-50 w-full">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <Navbar />

          <main className="flex-1 min-h-0 overflow-y-auto bg-[#f7f7f9] p-6 min-w-0">
            <div className="w-full max-w-full">{children}</div>
          </main>
        </div>

        <FloatingPriceButton />
        <FloatingReportsButton />
      </div>
    </AuthProvider>
  );
}
