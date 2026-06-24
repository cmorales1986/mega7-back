import MainLayoutClient from "@/components/layout/main-layout-client";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainLayoutClient>{children}</MainLayoutClient>;
}
