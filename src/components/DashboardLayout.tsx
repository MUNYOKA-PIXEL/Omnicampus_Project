import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import AppSidebar from "./AppSidebar";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <AppSidebar />
      <main className="min-h-dvh min-w-0 bg-background px-4 py-6 sm:px-8 sm:py-8 lg:ml-[280px] lg:p-12">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <span className="font-semibold text-primary">OmniCampus</span>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] border-0 bg-primary p-0 text-primary-foreground"
            >
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <SheetDescription className="sr-only">
                Navigate to a section of OmniCampus.
              </SheetDescription>
              <AppSidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
