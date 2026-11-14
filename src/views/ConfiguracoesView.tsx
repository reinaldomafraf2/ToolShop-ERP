import React, { useState, useEffect, useMemo } from 'react';
import {
  ConfiguracoesSistema,
  Operador,
  CentroCusto,
  ModoOperacaoSemMaterial,
  CATEGORIAS_CENTRO_CUSTO_SUGESTO,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import {
  getModoOperacaoSemMaterial,
  getCategoriasIsentasBloqueioMaterial,
} from '../utils/materialStatus';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { useAuth } from '../auth/AuthContext';
import {
  Sliders,
  ShieldAlert,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  UserCheck,
  ArrowRight,
  Save,
  Loader2,
  Trash2,
  Building2,
  Image as ImageIcon,
  Phone,
  MapPin,
  Upload,
  X,
  Package,
} from 'lucide-react';
import { formatDateTimeBR } from '../utils/formatters';
import { CalendarioTrabalhoCard } from '../components/configuracoes/CalendarioTrabalhoCard';

interface ConfiguracoesViewProps {
  operadores: Operador[];
  centrosCusto: CentroCusto[];
  onNavigateToOperadores?: () => void;
  onRefresh?: () => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  operadores,
  centrosCusto,
  onNavigateToOperadores,
  onRefresh,
}) => {
  const { user, can } = useAuth();
  const canEdit = can('editar', 'configuracoes');
  const isAdmin = user?.perfil === 'admin';

  const [config, setConfig] = useState<ConfiguracoesSistema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Formulário de Dados Cadastrais da Empresa (Exclusivo Admin)
  const [empresaForm, setEmpresaForm] = useState({
    nome: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    logo: '',
  });

  // Contagem de operadores sem postos vinculados
  const [operadoresSemPostoCount, setOperadoresSemPostoCount] = useState<number>(0);

  // Prazo de alerta para reservas paradas (dias)
  const [diasAlertaReservaInput, setDiasAlertaReservaInput] = useState<number>(30);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cfg, vinculos] = await Promise.all([
        toolShopService.getConfiguracoes(),
        toolShopService.getOperadorCentrosCusto(),
      ]);
      setConfig(cfg);
      setEmpresaForm({
        nome: cfg.empresa_nome || '',
        cnpj: cfg.empresa_cnpj || '',
        endereco: cfg.empresa_endereco || '',
        telefone: cfg.empresa_telefone || '',
        logo: cfg.empresa_logo || '',
      });
      setDiasAlertaReservaInput(cfg.dias_alerta_reserva_parada ?? 30);

      const vinculadosIds = new Set(vinculos.map((v) => v.operador_id));
      const semPosto = operadores.filter((op) => !vinculadosIds.has(op.id)).length;
      setOperadoresSemPostoCount(semPosto);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar configurações.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [operadores]);

  const [isPurging, setIsPurging] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleConfirmPurgeExamples = async () => {
    setIsPurging(true);
    try {
      await toolShopService.apagarDadosDeExemplo();
      showFeedback('success', 'Dados de exemplo apagados com sucesso! O sistema está pronto.');
      setIsPurgeModalOpen(false);
      await loadData();
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao purgar dados de exemplo.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleToggleRestringirPostos = async () => {
    if (!config || !canEdit || isSaving) return;
    const novoValor = !config.restringir_postos;
    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        { restringir_postos: novoValor },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      showFeedback(
        'success',
        novoValor
          ? 'Restrição de postos ativada com sucesso. Operadores só visualizarão operações dos seus postos de trabalho.'
          : 'Restrição de postos desativada. Operadores poderão visualizar todas as operações internas no apontamento.'
      );
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLiberarProxima = async () => {
    if (!config || !canEdit || isSaving) return;
    const novoValor = !config.liberar_apenas_proxima_operacao;
    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        { liberar_apenas_proxima_operacao: novoValor },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      showFeedback(
        'success',
        novoValor
          ? 'Sequenciamento estrito ativado. Uma operação só fica disponível quando a anterior do mesmo componente estiver Concluída ou Retornada.'
          : 'Sequenciamento estrito desativado. Operações pendentes e em andamento podem ser iniciadas independentemente da anterior.'
      );
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const modoSemMaterial = getModoOperacaoSemMaterial(config);
  const categoriasIsentas = getCategoriasIsentasBloqueioMaterial(config);

  const todasCategoriasDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    CATEGORIAS_CENTRO_CUSTO_SUGESTO.forEach((cat) => {
      map.set(cat.trim().toLowerCase(), cat);
    });
    centrosCusto.forEach((cc) => {
      const cat = (cc.categoria || cc.tipo || '').trim();
      if (cat && !map.has(cat.toLowerCase())) {
        map.set(cat.toLowerCase(), cat);
      }
    });
    categoriasIsentas.forEach((cat) => {
      const clean = cat.trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    });
    return Array.from(map.values());
  }, [centrosCusto, categoriasIsentas]);

  const handleChangeModoSemMaterial = async (novoModo: ModoOperacaoSemMaterial) => {
    if (!config || !canEdit || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        {
          operacoes_sem_material_recebido: novoModo,
          avisar_operador_material_pendente: novoModo !== 'ignorar',
        },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      const labelMsg =
        novoModo === 'ignorar'
          ? 'Modo definido como "Ignorar": operações aparecem normalmente sem aviso de material.'
          : novoModo === 'avisar'
          ? 'Modo definido como "Avisar": operadores verão alerta visual quando o material não estiver recebido.'
          : 'Modo definido como "Bloquear início": operações sem material recebido ficam bloqueadas (exceto categorias isentas).';
      showFeedback('success', labelMsg);
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCategoriaIsenta = async (categoria: string) => {
    if (!config || !canEdit || isSaving) return;
    const norm = categoria.trim().toLowerCase();
    const exists = categoriasIsentas.some((c) => c.trim().toLowerCase() === norm);
    const proximas = exists
      ? categoriasIsentas.filter((c) => c.trim().toLowerCase() !== norm)
      : [...categoriasIsentas, categoria];

    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        { categorias_isentas_bloqueio_material: proximas },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      showFeedback('success', 'Lista de categorias isentas do bloqueio atualizada.');
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao atualizar categorias isentas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermitirSaldoNegativo = async () => {
    if (!config || !canEdit || isSaving) return;
    const novoValor = !config.permitir_saldo_negativo;
    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        { permitir_saldo_negativo: novoValor },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      showFeedback(
        'success',
        novoValor
          ? 'Permissão de saldo negativo ativada. Saídas e reservas agora poderão exceder o saldo disponível se necessário.'
          : 'Permissão de saldo negativo desativada. Saídas e reservas acima do disponível serão bloqueadas estritamente.'
      );
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDiasAlertaReserva = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config || !canEdit || isSaving) return;
    const dias = Math.max(1, Math.min(365, Number(diasAlertaReservaInput) || 30));
    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        { dias_alerta_reserva_parada: dias },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      setDiasAlertaReservaInput(updated.dias_alerta_reserva_parada ?? 30);
      showFeedback('success', `Prazo para alerta de reservas paradas atualizado para ${dias} dias.`);
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 500 KB (500 * 1024 bytes)
    const maxSizeBytes = 500 * 1024;
    if (file.size > maxSizeBytes) {
      showFeedback('error', 'O arquivo de imagem excede o limite máximo permitido de 500 KB.');
      if (e.target) e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showFeedback('error', 'Formato inválido. Por favor envie uma imagem (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setEmpresaForm((prev) => ({ ...prev, logo: dataUrl }));
      showFeedback(
        'success',
        'Logotipo carregado na prévia! Clique em "Salvar Dados da Empresa" para confirmar.'
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setEmpresaForm((prev) => ({ ...prev, logo: '' }));
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSaving || !isAdmin) return;

    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        {
          empresa_nome: empresaForm.nome.trim() || undefined,
          empresa_cnpj: empresaForm.cnpj.trim() || undefined,
          empresa_endereco: empresaForm.endereco.trim() || undefined,
          empresa_telefone: empresaForm.telefone.trim() || undefined,
          empresa_logo: empresaForm.logo || undefined,
        },
        user?.nome || 'Administrador'
      );
      setConfig(updated);
      showFeedback(
        'success',
        'Dados da empresa e logotipo salvos com sucesso para cabeçalho das Folhas de Processos!'
      );
      onRefresh?.();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar dados da empresa.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
        <span className="text-xs font-medium">Carregando parâmetros do sistema...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerta de feedback */}
        <FeedbackAlert feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="h-6 w-6 text-slate-800" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Configurações de Chão de Fábrica
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Defina regras de permissão de apontamento, postos de trabalho e sequenciamento de
            operações.
          </p>
        </div>

        {config?.atualizado_em && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-2xs">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Última alteração por <strong>{config.atualizado_por || 'Sistema'}</strong> em{' '}
              {formatDateTimeBR(config.atualizado_em)}
            </span>
          </div>
        )}
      </div>

      {/* Aviso de Operadores Sem Posto */}
      {operadoresSemPostoCount > 0 && config?.restringir_postos && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">
                {operadoresSemPostoCount === 1
                  ? '1 operador ativo sem nenhum posto de trabalho vinculado'
                  : `${operadoresSemPostoCount} operadores ativos sem nenhum posto de trabalho vinculado`}
              </h4>
              <p className="mt-0.5 text-xs text-amber-800">
                Com a restrição de postos ativa, esses operadores não conseguirão visualizar nenhuma
                operação no terminal de apontamento até que seus postos sejam atribuídos.
              </p>
            </div>
          </div>

          {onNavigateToOperadores && (
            <button
              type="button"
              onClick={onNavigateToOperadores}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition-colors"
            >
              <UserCheck className="h-4 w-4" />
              <span>Regularizar na aba Operadores</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Configurações da Empresa (Exclusivo Administrador: Folha de Processos) */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Dados Cadastrais da Empresa
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Exclusivo Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Nome, CNPJ, endereço, telefone e logotipo exibidos no cabeçalho da Folha de Processos (Plano de Fabricação)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveEmpresa}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors self-start sm:self-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-amber-400" />
                  <span>Salvar Dados da Empresa</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSaveEmpresa} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome / Razão Social da Empresa
                </label>
                <input
                  type="text"
                  value={empresaForm.nome}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })}
                  placeholder="Ex: TOOLSHOP FERRAMENTARIA E USINAGEM LTDA"
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={empresaForm.cnpj}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                  placeholder="Ex: 00.000.000/0001-00"
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>Endereço Completo</span>
                </label>
                <input
                  type="text"
                  value={empresaForm.endereco}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })}
                  placeholder="Ex: Rua das Indústrias, 1000 - Distrito Industrial - Joinville/SC"
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>Telefone / Contato</span>
                </label>
                <input
                  type="text"
                  value={empresaForm.telefone}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })}
                  placeholder="Ex: (47) 3456-7890"
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Upload de Logotipo da Empresa (até 500 KB) */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                <span>Logotipo da Empresa (imagem opcional, até 500 KB):</span>
              </label>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {empresaForm.logo ? (
                  <div className="relative flex items-center justify-center p-2 rounded-xl border-2 border-slate-200 bg-slate-50 max-w-[200px] max-h-[80px]">
                    <img
                      src={empresaForm.logo}
                      alt="Logo da Empresa"
                      className="max-h-[60px] max-w-[180px] object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 rounded-full bg-rose-600 text-white p-1 shadow-sm hover:bg-rose-700"
                      title="Remover logotipo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[11px] font-medium text-center p-2">
                    Nenhum logo carregado
                  </div>
                )}

                <div className="space-y-1">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                    <Upload className="h-4 w-4 text-slate-500" />
                    <span>{empresaForm.logo ? 'Substituir Imagem...' : 'Selecionar Logotipo...'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Formatos aceitos: PNG, JPG, WebP ou SVG. Máximo: 500 KB.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Calendário de trabalho (Gerente e Administrador) */}
      <CalendarioTrabalhoCard
        config={config}
        canEdit={canEdit}
        usuarioNome={user?.nome || 'Administrador'}
        onUpdated={setConfig}
        onFeedback={showFeedback}
        onRefresh={onRefresh}
      />

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Restringir Operadores aos Seus Postos */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    config?.restringir_postos
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Restringir operadores aos seus postos de trabalho
                  </h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      config?.restringir_postos
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {config?.restringir_postos ? 'Ativo (Recomendado)' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                disabled={!canEdit || isSaving}
                onClick={handleToggleRestringirPostos}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  config?.restringir_postos ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={config?.restringir_postos}
                aria-label="Alternar restrição de postos de trabalho"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config?.restringir_postos ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Quando ligado, operadores autenticados só visualizam no tablet e só podem iniciar
              operações dos <strong>centros de custo vinculados ao seu cadastro</strong>. Operações de
              outros postos, terceirizadas ou sem centro de custo são bloqueadas tanto na tela quanto
              na camada de regras de negócio.
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Impacto Operacional:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                <li>
                  <strong>Operador:</strong> Lista filtrada e agrupada por postos atribuídos.
                </li>
                <li>
                  <strong>Líder/Gerência:</strong> Visualizam tudo e podem apontar em nome de
                  qualquer operador.
                </li>
                <li>
                  <strong>Desligado:</strong> O operador volta a ver todas as operações internas da
                  ferramentaria.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Padrão do Sistema: <strong>Ligado</strong></span>
            {!canEdit && (
              <span className="text-[11px] text-amber-700 italic">
                Apenas Gerente e Administrador podem alterar
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Liberar Operação Somente Quando Anterior Concluída */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    config?.liberar_apenas_proxima_operacao
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Liberar operação somente quando a anterior estiver concluída
                  </h3>
                  <span
                    className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      config?.liberar_apenas_proxima_operacao
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {config?.liberar_apenas_proxima_operacao ? 'Ativo (Estrito)' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                disabled={!canEdit || isSaving}
                onClick={handleToggleLiberarProxima}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  config?.liberar_apenas_proxima_operacao ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={config?.liberar_apenas_proxima_operacao}
                aria-label="Alternar liberação sequencial de operações"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config?.liberar_apenas_proxima_operacao ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Quando ligado, o operador só visualiza a próxima etapa produtiva de cada peça. Uma
              operação com sequência maior só é liberada para início quando a operação imediatamente
              anterior do mesmo componente estiver com status <strong>Concluída</strong> (se interna) ou{' '}
              <strong>Retornada</strong> (se terceirizada).
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Impacto Operacional:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                <li>
                  Evita que um operador inicie usinagem ou polimento antes do desbaste ou tratamento
                  térmico anterior.
                </li>
                <li>
                  Líderes e gerentes continuam visualizando a lista completa para fins de planejamento
                  e reordenação.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Padrão do Sistema: <strong>Desligado</strong></span>
            {!canEdit && (
              <span className="text-[11px] text-amber-700 italic">
                Apenas Gerente e Administrador podem alterar
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Operações sem Material Recebido */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Operações sem material recebido
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comportamento no Apontamento quando a matéria-prima ou item comercial do componente ainda não entrou no estoque.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    value: 'ignorar' as ModoOperacaoSemMaterial,
                    label: 'Ignorar',
                    desc: 'Não exibe aviso nem bloqueia.',
                  },
                  {
                    value: 'avisar' as ModoOperacaoSemMaterial,
                    label: 'Avisar (Padrão)',
                    desc: 'Exibe alerta amarelo, mas permite iniciar.',
                  },
                  {
                    value: 'bloquear' as ModoOperacaoSemMaterial,
                    label: 'Bloquear início',
                    desc: 'Impede início até o recebimento.',
                  },
                ] as const
              ).map((opt) => {
                const active = modoSemMaterial === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEdit || isSaving}
                    onClick={() => handleChangeModoSemMaterial(opt.value)}
                    className={`rounded-xl border p-3 text-left transition-all disabled:opacity-50 ${
                      active
                        ? opt.value === 'bloquear'
                          ? 'border-rose-600 bg-rose-50 text-rose-950 ring-1 ring-rose-600'
                          : opt.value === 'avisar'
                          ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-600'
                          : 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">{opt.label}</span>
                    <span
                      className={`block text-[10px] mt-0.5 ${
                        active && opt.value === 'ignorar' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lista de categorias de centros de custo isentas do bloqueio */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Categorias de centros de custo isentas do bloqueio:
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Padrão: Programação
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Operações em postos dessas categorias podem ser iniciadas (com aviso) mesmo quando o bloqueio estiver ativo.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {todasCategoriasDisponiveis.map((cat) => {
                  const checked = categoriasIsentas.some(
                    (c) => c.trim().toLowerCase() === cat.trim().toLowerCase()
                  );
                  return (
                    <label
                      key={cat}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                        checked
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!canEdit || isSaving}
                        checked={checked}
                        onChange={() => handleToggleCategoriaIsenta(cat)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Padrão: <strong>Avisar</strong> · Isenta: <strong>Programação</strong>
            </span>
            {!canEdit && (
              <span className="text-[11px] text-amber-700 italic">
                Apenas Gerente e Administrador podem alterar
              </span>
            )}
          </div>
        </div>

        {/* Card: Estoque - Parâmetros e Alertas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
          {/* Seção 1: Saldo Negativo */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Package className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Permitir saldo negativo no estoque de materiais
                </h3>
              </div>
              <p className="text-xs text-slate-500 pl-10">
                Flexibiliza saídas e reservas quando o saldo disponível no sistema for insuficiente.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto pl-10 sm:pl-0">
              <div className="text-right">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                    config?.permitir_saldo_negativo
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {config?.permitir_saldo_negativo ? 'Permitido (Flexível)' : 'Bloqueado (Padrão)'}
                </span>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                disabled={!canEdit || isSaving}
                onClick={handleTogglePermitirSaldoNegativo}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  config?.permitir_saldo_negativo ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={config?.permitir_saldo_negativo}
                aria-label="Alternar permissão de saldo negativo no estoque"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config?.permitir_saldo_negativo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 pl-10">
            Por padrão, saídas e reservas de materiais e consumíveis são bloqueadas caso a quantidade solicitada exceda o <strong>saldo disponível</strong> (saldo físico menos reservas ativas). Ative esta opção caso a oficina necessite lançar baixas físicas de material antes da nota fiscal ou cadastro de entrada no ERP.
          </p>

          {/* Seção 2: Dias para alertar reserva parada */}
          <div className="pt-5 border-t border-slate-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Dias para alertar reserva parada
                    </h3>
                    <p className="text-xs text-slate-500">
                      Gera aviso no Painel para reservas ativas que não tiveram retirada para produção após este período.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-10 sm:pl-0">
                <div className="relative w-28">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    disabled={!canEdit || isSaving}
                    value={diasAlertaReservaInput}
                    onChange={(e) => setDiasAlertaReservaInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-800 text-center shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                  <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">dias</span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleSaveDiasAlertaReserva}
                    disabled={isSaving || diasAlertaReservaInput === (config?.dias_alerta_reserva_parada ?? 30)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Salvar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Padrão do Sistema: Saldo negativo <strong>Desligado</strong> | Alerta de reservas: <strong>30 dias</strong></span>
            {!canEdit && (
              <span className="text-[11px] text-amber-700 italic">
                Apenas Gerente e Administrador podem alterar
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Limpeza de Dados de Demonstração */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Base de Dados e Registros de Demonstração
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Purga de dados fictícios de exemplo (projetos, peças, centros de custo, clientes e apontamentos)
                para início de operação em produção.
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(true)}
                disabled={isPurging}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-50"
              >
                {isPurging ? (
                  <Loader2 className="h-4 w-4 animate-spin text-rose-700" />
                ) : (
                  <Trash2 className="h-4 w-4 text-rose-700" />
                )}
                <span>Apagar Dados de Exemplo</span>
              </button>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              O sistema está configurado para operar com as tabelas limpas. Suas configurações e usuários autenticados são preservados com segurança.
            </span>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        onConfirm={handleConfirmPurgeExamples}
        title="Apagar Dados de Demonstração"
        itemName="todos os projetos, peças, apontamentos e dados de exemplo"
        entityTypeLabel="Dados de Demonstração"
        isDeleting={isPurging}
      />
    </div>
  );
};
