import React, { useState, useEffect } from 'react';
import { ConfiguracoesSistema, Operador, CentroCusto } from '../types';
import { toolShopService } from '../services/toolShopService';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
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
} from 'lucide-react';
import { formatDateTimeBR } from '../utils/formatters';

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

  const [config, setConfig] = useState<ConfiguracoesSistema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Contagem de operadores sem postos vinculados
  const [operadoresSemPostoCount, setOperadoresSemPostoCount] = useState<number>(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cfg, vinculos] = await Promise.all([
        toolShopService.getConfiguracoes(),
        toolShopService.getOperadorCentrosCusto(),
      ]);
      setConfig(cfg);

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

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handlePurgeExamples = async () => {
    if (!window.confirm('Deseja realmente apagar todos os dados de exemplo? Apenas configurações e usuários do sistema serão mantidos.')) {
      return;
    }
    setIsPurging(true);
    try {
      await toolShopService.apagarDadosDeExemplo();
      showFeedback('success', 'Dados de exemplo apagados com sucesso! O sistema está pronto.');
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

        {/* Card 3: Limpeza de Dados de Demonstração */}
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
                onClick={handlePurgeExamples}
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
    </div>
  );
};
