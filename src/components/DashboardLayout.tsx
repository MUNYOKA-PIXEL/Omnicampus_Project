import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-[280px] p-12 bg-background min-h-screen">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
