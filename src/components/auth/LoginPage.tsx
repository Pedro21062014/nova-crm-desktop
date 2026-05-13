import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input } from "@/components/ui";
import { Mail, Lock, AlertCircle, UserPlus, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoSvg from "/logo.svg";

type AuthMode = "login" | "signup";

export function LoginPage() {
  const { login, signup, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found") {
        setError("Usuário não encontrado. Verifique o email ou cadastre-se.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Email ou senha inválidos. Tente novamente.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Tente novamente mais tarde.");
      } else if (code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, displayName || undefined);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Este email já está cadastrado. Faça login.");
      } else if (code === "auth/weak-password") {
        setError("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="skeleton h-8 w-8 rounded-xl mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <AnimatePresence mode="wait">
        {mode === "login" ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm space-y-8 px-6"
          >
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <img
                src={logoSvg}
                alt="Nova CRM"
                className="h-14 w-14 rounded-2xl shadow-md"
              />
              <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Nova CRM
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entre com suas credenciais para acessar
                </p>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Input
                id="login-email"
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                id="login-password"
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
              >
                Entrar
              </Button>
            </form>

            {/* Switch to signup */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-accent font-medium hover:underline"
                >
                  Cadastre-se
                </button>
              </p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Aplicativo desktop · Dados sincronizados via Firebase
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="signup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm space-y-8 px-6"
          >
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <img
                src={logoSvg}
                alt="Nova CRM"
                className="h-14 w-14 rounded-2xl shadow-md"
              />
              <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Criar Conta
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre-se para começar a usar o Nova CRM
                </p>
              </div>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Input
                id="signup-name"
                label="Nome (opcional)"
                type="text"
                placeholder="Seu nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                icon={<UserPlus className="h-4 w-4" />}
              />

              <Input
                id="signup-email"
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                id="signup-password"
                label="Senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />

              <Input
                id="signup-confirm-password"
                label="Confirmar Senha"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
              >
                Criar Conta
              </Button>
            </form>

            {/* Switch to login */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-accent font-medium hover:underline"
                >
                  Fazer Login
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
