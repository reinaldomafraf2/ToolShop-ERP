import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  Wrench,
  KeyRound,
  Mail,
  Lock,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Clock,
  Delete,
  HardHat,
  Briefcase,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithMatricula, loginWithEmail, loginWithGoogle } = useAuth();

  // Modo de login: 'tablet' (Matrícula + PIN) ou 'gestao' (Email + Senha)
  const [activeTab, setActiveTab] = useState<'tablet' | 'gestao'>('tablet');

  // Estado do login chão de fábrica (iniciam vazios)
  const [matricula, setMatricula] = useState('');
  const [pin, setPin] = useState('');

  // Estado do login corporativo (iniciam vazios)
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submissão do login chão de fábrica (Matrícula + PIN)
  const handleSubmitTablet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginWithMatricula(matricula, pin);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha na autenticação do operador.');
      setIsLoading(false);
    }
  };

  // Submissão do login gestão (Email + Senha)
  const handleSubmitGestao = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginWithEmail(email, senha);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha na autenticação corporativa.');
      setIsLoading(false);
    }
  };

  // Submissão do login com Google Firebase
  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar com a conta Google.');
      setIsLoading(false);
    }
  };

  // Teclado numérico virtual para tablet chão de fábrica
  const handleKeypadPress = (digit: string) => {
    setErrorMessage(null);
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const handleKeypadBackspace = () => {
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setErrorMessage(null);
    setPin('');
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      {/* Container Principal Centralizado */}
      <div className="mx-auto w-full max-w-xl">
        {/* Topo / Wordmark ToolShop ERP */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-xl ring-1 ring-slate-700/80">
            <Wrench className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ToolShop ERP
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Sistema de Gestão Industrial & Apontamento de Ferramentaria
          </p>
        </div>

        {/* Card Dual de Autenticação */}
        <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-white shadow-2xl">
          {/* Seletor de Modo: Chão de Fábrica vs Gestão */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('tablet');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                activeTab === 'tablet'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardHat className="h-4 w-4 text-amber-600" />
              <span>Chão de Fábrica</span>
              <span className="hidden sm:inline rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                Tablet PIN
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('gestao');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                activeTab === 'gestao'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="h-4 w-4 text-blue-600" />
              <span>Gestão & Projetos</span>
              <span className="hidden sm:inline rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900">
                E-mail
              </span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* FORM 1: Chão de Fábrica (Matrícula + Teclado PIN) */}
            {activeTab === 'tablet' ? (
              <form onSubmit={handleSubmitTablet} className="space-y-4">
                <div className="text-left">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Matrícula do Operador ou Líder
                    </label>
                    <span className="text-[11px] text-slate-400">Identificação</span>
                  </div>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                    placeholder="Digite sua matrícula..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase text-slate-900 shadow-2xs focus:border-slate-900 focus:bg-white focus:outline-none"
                    autoCapitalize="characters"
                    required
                  />
                </div>

                <div className="text-left">
                  <label className="block text-xs font-semibold text-slate-700">
                    PIN Numérico de Acesso (4 a 6 dígitos)
                  </label>

                  {/* Display Visual dos Dígitos do PIN */}
                  <div className="mt-1.5 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
                    {pin.length === 0 ? (
                      <span className="text-xs text-slate-400">Digite seu PIN no teclado abaixo</span>
                    ) : (
                      pin.split('').map((_, i) => (
                        <div
                          key={i}
                          className="h-3.5 w-3.5 rounded-full bg-slate-900 transition-all duration-150 animate-in fade-in"
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Teclado Virtual Numérico com Botões Grandes (Otimizado para Tablet) */}
                <div className="pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadPress(num)}
                        disabled={isLoading}
                        className="flex h-12 sm:h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-base sm:text-lg font-bold text-slate-900 shadow-2xs transition active:bg-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleKeypadClear}
                      disabled={isLoading || pin.length === 0}
                      className="flex h-12 sm:h-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 transition active:bg-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      disabled={isLoading}
                      className="flex h-12 sm:h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-base sm:text-lg font-bold text-slate-900 shadow-2xs transition active:bg-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      disabled={isLoading || pin.length === 0}
                      className="flex h-12 sm:h-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition active:bg-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Botão Entrar Tablet */}
                <button
                  type="submit"
                  disabled={isLoading || pin.length < 4 || !matricula.trim()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/20 transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Chão de Fábrica</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORM 2: Gestão & Engenharia (E-mail + Senha) */
              <form onSubmit={handleSubmitGestao} className="space-y-4">
                <div className="text-left">
                  <label className="block text-xs font-semibold text-slate-700">
                    E-mail de Acesso Corporativo
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@empresa.com.br"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 shadow-2xs focus:border-slate-900 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-xs font-semibold text-slate-700">
                    Senha Corporativa
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Digite sua senha..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 shadow-2xs focus:border-slate-900 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Botão Entrar Gestão */}
                <button
                  type="submit"
                  disabled={isLoading || !email.trim() || !senha.trim()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Acessar Painel de Gestão</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Divisor Google */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[11px] font-medium text-slate-400">
                  ou autenticação em nuvem
                </span>
              </div>
            </div>

            {/* Botão Entrar com Google (Firebase Auth) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Google (Firebase)</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Sincronizado na nuvem com Firebase Firestore • Segurança Zero-Trust</span>
        </div>
      </div>
    </div>
  );
};
