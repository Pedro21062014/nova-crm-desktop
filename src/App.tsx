import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout";
import { LoginPage } from "@/components/auth/LoginPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ProductsPage } from "@/components/products/ProductsPage";
import { ClientsPage } from "@/components/clients/ClientsPage";
import { OrdersPage } from "@/components/orders/OrdersPage";
import { CouponsPage } from "@/components/coupons/CouponsPage";
import { ChatPage } from "@/components/chat/ChatPage";
import { WhatsAppPage } from "@/components/whatsapp/WhatsAppPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { AIChatPage } from "@/components/ai/AIChatPage";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="skeleton h-8 w-8 rounded-xl mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/pedidos" element={<OrdersPage />} />
        <Route path="/cupons" element={<CouponsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/whatsapp" element={<WhatsAppPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/ia" element={<AIChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </HashRouter>
  );
}
