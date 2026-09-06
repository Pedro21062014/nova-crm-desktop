import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ActiveStoreProvider } from "@/hooks/useActiveStore";
import { ToastProvider } from "@/hooks/useToast";
import { AppLayout } from "@/components/layout";
import { LoginPage } from "@/components/auth/LoginPage";
import { TeamPage } from "@/components/team/TeamPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ProductsPage } from "@/components/products/ProductsPage";
import { ClientsPage } from "@/components/clients/ClientsPage";
import { OrdersPage } from "@/components/orders/OrdersPage";
import { CouponsPage } from "@/components/coupons/CouponsPage";
import { PipelinePage } from "@/components/pipeline/PipelinePage";
import { ProposalsPage } from "@/components/proposals/ProposalsPage";
import { TasksPage } from "@/components/tasks/TasksPage";
import { AutomationsPage } from "@/components/automations/AutomationsPage";
import { ChatPage } from "@/components/chat/ChatPage";
import { MinhaLojaPage } from "@/components/store/MinhaLojaPage";
import { SettingsPage } from "@/components/settings/SettingsPage";


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
    <ActiveStoreProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/minha-loja" element={<MinhaLojaPage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/cupons" element={<CouponsPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/propostas" element={<ProposalsPage />} />
          <Route path="/tarefas" element={<TasksPage />} />
          <Route path="/automacoes" element={<AutomationsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/equipe" element={<TeamPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ActiveStoreProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <ProtectedRoutes />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
