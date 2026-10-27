import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Entrar · TecnoFix OS" },
      { name: "description", content: "Acesso restrito à equipe da assistência técnica." },
      { property: "og:title", content: "Entrar · TecnoFix OS" },
      { property: "og:description", content: "Acesso restrito à equipe da assistência técnica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) { toast.error("E-mail ou senha inválidos."); return; }
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-6">
      <form onSubmit={entrar} className="grid w-full max-w-sm gap-5 rounded-xl border bg-card p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Wrench className="size-5" /></div>
          <div>
            <h1 className="font-display text-lg font-bold">TecnoFix OS</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito à equipe</p>
          </div>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="senha">Senha</Label><Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <Button type="submit" disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</Button>
        <p className="text-center text-xs text-muted-foreground">Não tem acesso? Peça ao administrador para cadastrar você.</p>
      </form>
    </div>
  );
}
