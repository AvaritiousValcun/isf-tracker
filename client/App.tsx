import "./global.css";
import "./lib/init-i18n";


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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#B8BFC1]">
        <div className="text-[14px] font-medium text-[#2C4C5C]">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? <Index /> : <AuthPage />
        }
      />

      <Route
        path="/emergency/:token"
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

