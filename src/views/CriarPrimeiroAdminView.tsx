import React, { useState } from 'react';
import {
  Wrench,
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const CriarPrimeiroAdminView: React.FC = () => {
  const { setupFirstAdmin } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPasswordValid = senha.length >= 8;
  const doPasswordsMatch = senha.length > 0 && senha === confirmacaoSenha;
  const isFormValid = nome.trim().length > 0 && email.includes('@') && isPasswordValid && doPasswordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!nome.trim()) {
      setErrorMessage('Informe o nome completo do administrador.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Informe um e-mail corporativo válido.');
      return;
    }

    if (senha.length < 8) {
      setErrorMessage('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (senha !== confirmacaoSenha) {
      setErrorMessage('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setIsLoading(true);
    try {
      await setupFirstAdmin({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senha,
        confirmacaoSenha,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao inicializar primeiro administrador.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-500 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Marca / Topo */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-xl shadow-amber-400/20 mb-3">
            <Wrench className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            ToolShop ERP
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Sistema Integrado de Gestão de Ferramentaria
          </p>
        </div>

        {/* Card Principal */}
        <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/90 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-slate-700/80 bg-slate-800/60 p-6 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
              <Shield className="h-3.5 w-3.5" />
              <span>Configuração Inicial do Sistema</span>
            </div>
            <h2 className="text-xl font-bold text-white">Criar Primeiro Administrador</h2>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Não há administrador cadastrado. Crie a conta do gestor principal para inicializar o controle corporativo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Campo Nome */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Nome Completo do Gestor
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Almeida"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>
            </div>

            {/* Campo E-mail */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                E-mail Corporativo (Login de Acesso)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: gestor@ferramentaria.com.br"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Senha de Acesso (Mínimo 8 caracteres)
                </label>
                <span className={`text-[11px] font-mono ${isPasswordValid ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {senha.length}/8 carac.
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmação de Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Confirmação da Senha
                </label>
                {doPasswordsMatch && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Conferem</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmacaoSenha}
                  onChange={(e) => setConfirmacaoSenha(e.target.value)}
                  placeholder="Repita a senha..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Aviso de Criptografia PBKDF2 */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Padrão Criptográfico Corporativo</span>
              </div>
              <p>
                A senha será protegida via Web Crypto API com algoritmo PBKDF2 (HMAC-SHA-256), salt aleatório individual e 200.000 iterações de segurança.
              </p>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Configurando e derivando chave...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Criar Administrador e Iniciar</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
