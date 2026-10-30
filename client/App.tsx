import "./global.css";

import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import {
  AuthProvider,
  useAuth,
} from "@/hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import EmergencyAccessPage from "./pages/EmergencyAccessPage";
import MicroneedleVisualization from "./pages/MicroneedleVisualization";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e181d]">
        <div className="text-[14px] font-medium text-[#B8BFC1]">
          Loading ISF Tracker...
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user && showDashboard ? (
            <Index onReturnToHome={() => setShowDashboard(false)} />
          ) : (
            <AuthPage onOpenDashboard={() => setShowDashboard(true)} />
          )
        }
      />

      <Route
        path="/dashboard"
        element={<Index onReturnToHome={() => setShowDashboard(false)} />}
      />

      <Route
        path="/emergency/:token"
        element={<EmergencyAccessPage />}
      />

      <Route
        path="/provider/view/:token"
        element={<EmergencyAccessPage />}
      />

      <Route
        path="/product-concept"
        element={<MicroneedleVisualization />}
      />

      <Route
        path="*"
        element={<NotFound />}
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(
  document.getElementById("root")!,
).render(<App />);
