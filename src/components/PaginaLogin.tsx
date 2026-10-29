import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Wrench, Lock, Mail, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useEstoque, perfilInicial } from "@/lib/estoque";
import {
  useAuth,
  realizarLogin,
  obterStatusBloqueioEmail,
  formatarTempoBloqueio,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaginaLogin() {
  const { perfil = perfilInicial } = useEstoque();
  const { usuarioAtual } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [segundosBloqueio, setSegundosBloqueio] = useState<number>(0);

  useEffect(() => {
    if (usuarioAtual && usuarioAtual.ativo) {
      navigate({ to: "/" });
    }
  }, [usuarioAtual, navigate]);

  // Verifica e atualiza em tempo real o contador regressivo de bloqueio (15 minutos) para o e-mail digitado
  useEffect(() => {
    const atualizarContador = () => {
      const status = obterStatusBloqueioEmail(email);
      setSegundosBloqueio(status.bloqueado ? status.segundosRestantes : 0);
    };
    atualizarContador();
    const timer = window.setInterval(atualizarContador, 1000);
    return () => window.clearInterval(timer);
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const statusPre = obterStatusBloqueioEmail(email);
    if (statusPre.bloqueado) {
      setSegundosBloqueio(statusPre.segundosRestantes);
      const msg = `Acesso bloqueado temporariamente por 5 tentativas incorretas. Tempo restante: ${formatarTempoBloqueio(statusPre.segundosRestantes)}.`;
      setErroMsg(msg);
      toast.error(msg);
      return;
    }

    setErroMsg(null);
    setIsSubmitting(true);

    try {
      const resultado = await realizarLogin(email, senha);
      if (!resultado.ok) {
        if (resultado.bloqueado && resultado.segundosRestantes) {
          setSegundosBloqueio(resultado.segundosRestantes);
        }
        setErroMsg(resultado.erro ?? "Falha ao entrar no sistema.");
        toast.error(resultado.erro ?? "Falha ao entrar no sistema.");
        return;
      }

      setSegundosBloqueio(0);
      toast.success(`Bem-vindo(a), ${resultado.usuario?.nome}!`);
      navigate({ to: "/" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const estaBloqueado = segundosBloqueio > 0;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        {/* Cabeçalho com a Logo da Empresa */}
        <div className="flex flex-col items-center text-center">
          {perfil.logo ? (
            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
              <img
                src={perfil.logo}
                alt={perfil.nome || "Logo da Empresa"}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Wrench className="size-8" />
            </div>
          )}

          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {perfil.nome || "AtosPro Assistência Técnica"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso restrito a colaboradores autorizados
          </p>
        </div>

        {/* Formulário contendo apenas E-mail, Senha e o botão Entrar */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="login-email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder="seu.email@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={160}
                autoComplete="email"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-senha">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                maxLength={128}
                autoComplete="current-password"
                className="pl-9"
              />
            </div>
          </div>

          {estaBloqueado && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Bloqueio temporário de segurança ativo (15 minutos)
                </p>
                <p className="mt-0.5">
                  Excesso de tentativas incorretas para este e-mail. Tente novamente em{" "}
                  <span className="font-mono font-bold underline">
                    {formatarTempoBloqueio(segundosBloqueio)}
                  </span>
                  .
                </p>
              </div>
            </div>
          )}

          {!estaBloqueado && erroMsg && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {erroMsg}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || estaBloqueado}
            className="w-full gap-2 font-semibold"
          >
            <LogIn className="size-4" />
            {estaBloqueado
              ? `Bloqueado (${formatarTempoBloqueio(segundosBloqueio)})`
              : isSubmitting
                ? "Entrando..."
                : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

