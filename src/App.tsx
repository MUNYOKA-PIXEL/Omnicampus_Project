import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";

const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/features/auth/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/pages/ResetPasswordPage"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Register = lazy(() => import("./pages/Register"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const LibraryPage = lazy(() =>
  import("@/features/library").then(({ LibraryPage }) => ({ default: LibraryPage })),
);
const LibraryAdminPage = lazy(() => import("@/features/library/pages/LibraryAdminPage"));
const LostFoundPage = lazy(() =>
  import("@/features/lost-found").then(({ LostFoundPage }) => ({ default: LostFoundPage })),
);
const ClubsPage = lazy(() =>
  import("@/features/clubs").then(({ ClubsPage }) => ({ default: ClubsPage })),
);
const ClubAdminPage = lazy(() => import("@/features/clubs/pages/ClubAdminPage"));
const MedicalPage = lazy(() =>
  import("@/features/medical").then(({ MedicalPage }) => ({ default: MedicalPage })),
);
const MedicalAdminPage = lazy(() => import("@/features/medical/pages/MedicalAdminPage"));
const ProfilePage = lazy(() =>
  import("@/features/profile").then(({ ProfilePage }) => ({ default: ProfilePage })),
);
const AIAssistantPage = lazy(() =>
  import("@/features/ai-assistant").then(({ AIAssistantPage }) => ({
    default: AIAssistantPage,
  })),
);
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const LibraryRoute = () => {
  const { role } = useAuth();
  return role === "libadmin" || role === "superadmin" ? <LibraryAdminPage /> : <LibraryPage />;
};

const ClubsRoute = () => {
  const { role } = useAuth();
  return role === "clubadmin" || role === "superadmin" ? <ClubAdminPage /> : <ClubsPage />;
};

const MedicalRoute = () => {
  const { role } = useAuth();
  return role === "medadmin" || role === "superadmin" ? <MedicalAdminPage /> : <MedicalPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense
            fallback={
              <div className="p-8 text-center text-muted-foreground" role="status">
                Loading page...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["superadmin", "student"]}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute
                    allowedRoles={["superadmin", "student", "libadmin", "medadmin", "clubadmin"]}
                  >
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/library"
                element={
                  <ProtectedRoute allowedRoles={["superadmin", "libadmin", "student"]}>
                    <LibraryRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lost-found"
                element={
                  <ProtectedRoute allowedRoles={["superadmin", "student"]}>
                    <LostFoundPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clubs"
                element={
                  <ProtectedRoute allowedRoles={["superadmin", "clubadmin", "student"]}>
                    <ClubsRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medical"
                element={
                  <ProtectedRoute allowedRoles={["superadmin", "medadmin", "student"]}>
                    <MedicalRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute
                    allowedRoles={["superadmin", "student", "libadmin", "medadmin", "clubadmin"]}
                  >
                    <AIAssistantPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
