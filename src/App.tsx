import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import LoginPage from "@/features/auth/pages/LoginPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import AdminLogin from "./pages/AdminLogin.tsx";
import Register from "./pages/Register.tsx";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { LibraryPage } from "@/features/library";
import { LostFoundPage } from "@/features/lost-found";
import { ClubsPage } from "@/features/clubs";
import { MedicalPage } from "@/features/medical";
import { ProfilePage } from "@/features/profile";
import { AIAssistantPage } from "@/features/ai-assistant";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={["superadmin", "student"]}>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={["superadmin", "student", "libadmin", "medadmin", "clubadmin"]}>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/library" element={
              <ProtectedRoute allowedRoles={["superadmin", "libadmin", "student"]}>
                <LibraryPage />
              </ProtectedRoute>
            } />
            <Route path="/lost-found" element={
              <ProtectedRoute allowedRoles={["superadmin", "student"]}>
                <LostFoundPage />
              </ProtectedRoute>
            } />
            <Route path="/clubs" element={
              <ProtectedRoute allowedRoles={["superadmin", "clubadmin", "student"]}>
                <ClubsPage />
              </ProtectedRoute>
            } />
            <Route path="/medical" element={
              <ProtectedRoute allowedRoles={["superadmin", "medadmin", "student"]}>
                <MedicalPage />
              </ProtectedRoute>
            } />
            <Route path="/assistant" element={
              <ProtectedRoute allowedRoles={["superadmin", "student"]}>
                <AIAssistantPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
