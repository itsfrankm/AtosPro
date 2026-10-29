import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  Users,
  ShieldAlert,
  Mail,
  User,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAuth,
  criarLoginPeloAdmin,
  editarDadosUsuarioPeloAdmin,
  alterarSenhaUsuarioPeloAdmin,
  alternarStatusUsuarioPeloAdmin,
  excluirUsuarioPeloAdmin,
  sincronizarUsuariosSupabase,
  type UsuarioSistema,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/gerenciar-logins")({
  component: PaginaGerenciarLogins,
});

function PaginaGerenciarLogins() {
  const { usuarioAtual, usuarios } = useAuth();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Modal de alterar senha
  const [usuarioParaSenha, setUsuarioParaSenha] = useState<UsuarioSistema | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // Modal de editar dados (nome e e-mail)
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<UsuarioSistema | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [emailEdicao, setEmailEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    if (usuarioAtual?.role === "admin" && usuarioAtual.ativo) {
      void sincronizarUsuariosSupabase();
    }
  }, [usuarioAtual]);

  // Proteção exclusiva para o Administrador ativo
  if (!usuarioAtual || !usuarioAtual.ativo || usuarioAtual.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-foreground">
          Acesso Restrito ao Administrador
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Esta página é exclusiva para o administrador principal do sistema gerenciar os acessos da equipe.
        </p>
        <Link to="/" className="mt-6">
          <Button>Voltar ao Painel Principal</Button>
        </Link>
      </div>
    );
  }

  async function handleCriarLogin(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await criarLoginPeloAdmin({ nome, email, senha });
      if (!res.ok) {
        toast.error(res.erro ?? "Não foi possível criar o login.");
        return;
      }

      toast.success(
        `Login criado com sucesso para ${res.usuario?.nome}! Conta já ativa imediatamente.`,
      );
      setNome("");
      setEmail("");
      setSenha("");
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioParaSenha) return;
    setSalvandoSenha(true);
    try {
      const res = await alterarSenhaUsuarioPeloAdmin(usuarioParaSenha.id, novaSenha);
      if (!res.ok) {
        toast.error(res.erro ?? "Erro ao alterar a senha.");
        return;
      }
      toast.success(`Senha de ${usuarioParaSenha.nome} atualizada com sucesso!`);
      setUsuarioParaSenha(null);
      setNovaSenha("");
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioParaEditar) return;
    setSalvandoEdicao(true);
    try {
      const res = await editarDadosUsuarioPeloAdmin(usuarioParaEditar.id, {
        nome: nomeEdicao,
        email: emailEdicao,
      });
      if (!res.ok) {
        toast.error(res.erro ?? "Erro ao atualizar dados.");
        return;
      }
      toast.success(
        usuarioParaEditar.role === "admin"
          ? "Dados do Administrador atualizados com sucesso! Utilize o novo e-mail no próximo login."
          : `Dados de ${res.usuario?.nome} atualizados com sucesso!`,
      );
      setUsuarioParaEditar(null);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleAlternarStatus(u: UsuarioSistema) {
    const res = await alternarStatusUsuarioPeloAdmin(u.id);
    if (!res.ok) {
      toast.error(res.erro ?? "Erro ao alterar status do usuário.");
      return;
    }
    toast.success(
      res.ativo
        ? `Acesso de ${u.nome} foi reativado.`
        : `Acesso de ${u.nome} foi desativado.`,
    );
  }

  async function handleExcluirUsuario(u: UsuarioSistema) {
    const res = await excluirUsuarioPeloAdmin(u.id);
    if (!res.ok) {
      toast.error(res.erro ?? "Erro ao excluir acesso.");
      return;
    }
    toast.success(`O login de ${u.nome} foi excluído permanentemente.`);
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Gerenciar Logins
            </h1>
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <ShieldCheck className="size-3.5" />
              Exclusivo Admin
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie contas ativas na hora para sua equipe e gerencie permissões, senhas e acessos ao sistema.
          </p>
        </div>
      </div>

      {/* Formulário para Criar Novo Login */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Criar Novo Login de Acesso
            </h2>
            <p className="text-xs text-muted-foreground">
              A conta é criada já confirmada e ativa imediatamente (via Admin API), sem desconectar sua sessão.
            </p>
          </div>
        </div>

        <form onSubmit={handleCriarLogin} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="novo-nome">Nome da Pessoa</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="novo-nome"
                placeholder="Ex.: Lucas Técnico"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="novo-email"
                type="email"
                placeholder="lucas@atospro.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nova-senha-cadastro">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="nova-senha-cadastro"
                type="password"
                placeholder="Mínimo de 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="pl-9"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex justify-end pt-2">
            <Button type="submit" disabled={salvando} className="gap-2">
              <UserPlus className="size-4" />
              {salvando ? "Criando Login..." : "Criar Login Agora"}
            </Button>
          </div>
        </form>
      </div>

      {/* Tabela de Logins Criados */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Users className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                Logins Cadastrados no Sistema
              </h2>
              <p className="text-xs text-muted-foreground">
                Gerencie os acessos criados, altere senhas ou desative/exclua colaboradores.
              </p>
            </div>
          </div>
          <Badge variant="secondary">{usuarios.length} conta(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground whitespace-nowrap">
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Nome da Pessoa</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">E-mail</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Perfil / Role</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Criado em</th>
                <th className="px-5 py-3.5 text-right font-semibold whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usuarios.map((u) => {
                const isOwnerAdmin = u.role === "admin";
                return (
                  <tr key={u.id} className="hover:bg-muted/20 whitespace-nowrap">
                    <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap">
                      {u.nome}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{u.email}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {isOwnerAdmin ? (
                        <Badge className="bg-primary text-primary-foreground whitespace-nowrap">
                          Admin (Dono)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="whitespace-nowrap">Usuário</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {u.ativo ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 whitespace-nowrap">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="whitespace-nowrap">Desativado</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {u.criadoEm}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap flex-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs whitespace-nowrap shrink-0"
                          onClick={() => {
                            setUsuarioParaEditar(u);
                            setNomeEdicao(u.nome);
                            setEmailEdicao(u.email);
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs whitespace-nowrap shrink-0"
                          onClick={() => {
                            setUsuarioParaSenha(u);
                            setNovaSenha("");
                          }}
                        >
                          <KeyRound className="size-3.5" />
                          Alterar Senha
                        </Button>

                        {!isOwnerAdmin && (
                          <>
                            <Button
                              type="button"
                              variant={u.ativo ? "secondary" : "default"}
                              size="sm"
                              className="h-8 gap-1.5 text-xs whitespace-nowrap shrink-0"
                              onClick={() => handleAlternarStatus(u)}
                            >
                              {u.ativo ? (
                                <>
                                  <Ban className="size-3.5" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="size-3.5" />
                                  Ativar
                                </>
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-8 gap-1.5 text-xs whitespace-nowrap shrink-0"
                              onClick={() => handleExcluirUsuario(u)}
                            >
                              <Trash2 className="size-3.5" />
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Editar Dados (Nome e E-mail) */}
      <Dialog
        open={!!usuarioParaEditar}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setUsuarioParaEditar(null);
            setNomeEdicao("");
            setEmailEdicao("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dados de Acesso</DialogTitle>
            <DialogDescription>
              Altere o nome e o e-mail de login de{" "}
              <span className="font-semibold text-foreground">
                {usuarioParaEditar?.nome}
              </span>.
            </DialogDescription>
          </DialogHeader>

          {usuarioParaEditar?.role === "admin" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
              <span className="font-bold">Aviso importante:</span> Ao alterar o e-mail do Administrador (Dono), utilize este novo e-mail para acessar o sistema no seu próximo login.
            </div>
          )}

          <form onSubmit={handleSalvarEdicao} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="modal-edit-nome">Nome da Pessoa</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="modal-edit-nome"
                  type="text"
                  placeholder="Nome do usuário ou Administrador"
                  value={nomeEdicao}
                  onChange={(e) => setNomeEdicao(e.target.value)}
                  className="pl-9"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-edit-email">E-mail de Login</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="modal-edit-email"
                  type="email"
                  placeholder="exemplo@email.com"
                  value={emailEdicao}
                  onChange={(e) => setEmailEdicao(e.target.value)}
                  className="pl-9"
                  required
                  maxLength={160}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUsuarioParaEditar(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoEdicao}>
                {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Alterar Senha */}
      <Dialog
        open={!!usuarioParaSenha}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setUsuarioParaSenha(null);
            setNovaSenha("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha de Acesso</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para{" "}
              <span className="font-semibold text-foreground">
                {usuarioParaSenha?.nome}
              </span>{" "}
              ({usuarioParaSenha?.email}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarNovaSenha} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="modal-nova-senha">Nova Senha</Label>
              <Input
                id="modal-nova-senha"
                type="password"
                placeholder="Digite a nova senha (mín. 6 caracteres)"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUsuarioParaSenha(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoSenha}>
                {salvandoSenha ? "Salvando..." : "Salvar Nova Senha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

