import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ModeloComponente,
  ModeloOperacao,
  TipoMaquina,
  HistoricoImportacao,
  Maquina,
  ConfiguracoesSistema,
} from '../types';
import { toolShopService } from '../services/toolShopService';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDeleteModal } from '../components/common/ConfirmDeleteModal';
import { FeedbackAlert } from '../components/common/FeedbackAlert';
import { EmptyState } from '../components/common/EmptyState';
import { FolhaProcessosModal } from '../components/common/FolhaProcessosModal';
import {
  downloadPlanilhaModeloBiblioteca,
  parseArquivoBiblioteca,
  ModeloImportAgrupado,
  TIPOS_MAQUINA_PERMITIDOS,
} from '../utils/excelImport';
import { formatHours, formatDateBR } from '../utils/formatters';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Trash2,
  Edit2,
  FileText,
  History,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Cpu,
  RefreshCw,
  Printer,
} from 'lucide-react';

interface BibliotecaViewProps {
  onRefresh?: () => void;
}

export const BibliotecaView: React.FC<BibliotecaViewProps> = ({ onRefresh }) => {
  const { user, perfil, can } = useAuth();
  const canImport = can('importar', 'biblioteca');
  const canEdit = can('editar', 'biblioteca');
  const canCreate = can('criar', 'biblioteca');
  const canDelete = can('excluir', 'biblioteca');

  const [activeTab, setActiveTab] = useState<'modelos' | 'historico'>('modelos');
  const [modelos, setModelos] = useState<ModeloComponente[]>([]);
  const [historico, setHistorico] = useState<HistoricoImportacao[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [expandedModelIds, setExpandedModelIds] = useState<Record<string, boolean>>({});

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // --- MODAL DE IMPORTAÇÃO DE ROTEIROS (EXCEL / CSV) ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importGrupos, setImportGrupos] = useState<ModeloImportAgrupado[]>([]);
  const [importErrosGerais, setImportErrosGerais] = useState<string[]>([]);
  const [expandedImportRows, setExpandedImportRows] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MODAL MANUAL DE CRIAR/EDITAR MODELO ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<ModeloComponente | null>(null);
  const [modeloForm, setModeloForm] = useState({
    codigo: '',
    nome: '',
    categoria: 'Placas e Bases',
    material: 'Aço P20 Beneficiado',
    observacoes: '',
  });
  const [formOperacoes, setFormOperacoes] = useState<
    Array<{
      id: string;
      sequencia: number;
      descricao: string;
      instrucoes?: string;
      tipo_maquina: TipoMaquina;
      horas_estimadas: string;
      prazo_dias?: number;
      fornecedor?: string;
    }>
  >([]);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // --- MODAL EXCLUSÃO ---
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    id: string;
    nome: string;
    codigo: string;
  }>({
    isOpen: false,
    id: '',
    nome: '',
    codigo: '',
  });

  // --- MODAL FOLHA DE PROCESSOS DO MODELO ---
  const [folhaProcessoModelo, setFolhaProcessoModelo] = useState<ModeloComponente | null>(null);
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [modList, histList, maqList, config] = await Promise.all([
        toolShopService.getModelos(),
        toolShopService.getHistoricoImportacoes(30),
        toolShopService.getMaquinas(),
        toolShopService.getConfiguracoes().catch(() => null),
      ]);
      setModelos(modList);
      setHistorico(histList);
      setMaquinas(maqList);
      if (config) setConfigEmpresa(config);
    } catch (err) {
      console.error('Erro ao carregar biblioteca:', err);
      setFeedback({ type: 'error', message: 'Falha ao carregar dados da biblioteca.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>();
    modelos.forEach((m) => {
      if (m.categoria) cats.add(m.categoria);
    });
    return Array.from(cats);
  }, [modelos]);

  const filteredModelos = useMemo(() => {
    return modelos.filter((m) => {
      const matchCat =
        selectedCategoria === 'Todas' || m.categoria === selectedCategoria;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.codigo.toLowerCase().includes(q) ||
        m.nome.toLowerCase().includes(q) ||
        m.material.toLowerCase().includes(q) ||
        (m.categoria && m.categoria.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [modelos, selectedCategoria, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedModelIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- CONTROLE DE IMPORTAÇÃO ---
  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportErrosGerais([]);
    setImportGrupos([]);

    try {
      const { modelosAgrupados, errosGerais } = await parseArquivoBiblioteca(file, modelos);
      setImportGrupos(modelosAgrupados);
      setImportErrosGerais(errosGerais);
    } catch (err) {
      setImportErrosGerais([
        `Erro ao processar planilha: ${err instanceof Error ? err.message : 'Arquivo corrompido ou formato não suportado.'}`,
      ]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleToggleAcaoConflito = (codigo: string, novaAcao: 'atualizar' | 'ignorar') => {
    setImportGrupos((prev) =>
      prev.map((g) => (g.codigo === codigo ? { ...g, acaoConflito: novaAcao } : g))
    );
  };

  const handleConfirmImport = async () => {
    if (!user || importGrupos.length === 0) return;

    // Filtra apenas modelos com status válido ou com aviso (que tenham operações válidas)
    const modelosParaGravar = importGrupos.filter((g) => g.operacoes.length > 0);

    if (modelosParaGravar.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Nenhum roteiro válido encontrado para importação.',
      });
      return;
    }

    setIsSavingImport(true);
    try {
      const resultado = await toolShopService.importarModelosBiblioteca({
        modelos: modelosParaGravar.map((g) => ({
          codigo: g.codigo,
          nome: g.nome,
          categoria: g.categoria,
          material: g.material,
          observacoes: g.observacoes,
          operacoes: g.operacoes,
          acaoConflito: g.acaoConflito,
        })),
        usuario: { id: user.id, nome: user.nome },
        arquivoNome: importFile?.name || 'importacao_roteiros.xlsx',
      });

      setFeedback({
        type: 'success',
        message: `Importação concluída com sucesso! ${resultado.criados} novo(s) modelo(s), ${resultado.atualizados} atualizado(s) e ${resultado.totalOperacoes} operações gravadas.`,
      });

      setIsImportModalOpen(false);
      setImportFile(null);
      setImportGrupos([]);
      loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Falha na importação: ${err instanceof Error ? err.message : 'Erro desconhecido.'}`,
      });
    } finally {
      setIsSavingImport(false);
    }
  };

  const [openInstructionIdx, setOpenInstructionIdx] = useState<Record<number, boolean>>({});
  const [expandedModelOpInstructions, setExpandedModelOpInstructions] = useState<Record<string, boolean>>({});

  // --- CRUD MANUAL DE MODELO ---
  const handleOpenCreateModal = () => {
    setEditingModelo(null);
    setModeloForm({
      codigo: '',
      nome: '',
      categoria: 'Placas e Bases',
      material: 'Aço P20 Beneficiado',
      observacoes: '',
    });
    setFormOperacoes([
      {
        id: `mop_${Date.now()}_1`,
        sequencia: 10,
        descricao: 'Desbaste e esquadrejamento de faces',
        instrucoes: 'LADO SUPERIOR:\n#CALÇO#\n_facear 1mm;\n_esquadrejar cantos;',
        tipo_maquina: 'Fresa',
        horas_estimadas: '4,0',
      },
      {
        id: `mop_${Date.now()}_2`,
        sequencia: 20,
        descricao: 'Usinagem CNC de alta velocidade',
        instrucoes: 'DESBASTE E ACABAMENTO 3D:\n_fresar alojamentos conforme 3D;\n_furação de roscas e passagens;',
        tipo_maquina: 'CNC',
        horas_estimadas: '8,0',
      },
    ]);
    setOpenInstructionIdx({});
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (m: ModeloComponente) => {
    setEditingModelo(m);
    setModeloForm({
      codigo: m.codigo,
      nome: m.nome,
      categoria: m.categoria || 'Geral',
      material: m.material || 'Aço Ferramenta',
      observacoes: m.observacoes || '',
    });
    setFormOperacoes(
      m.operacoes.map((op) => ({
        id: op.id,
        sequencia: op.sequencia,
        descricao: op.descricao,
        instrucoes: op.instrucoes || '',
        tipo_maquina: op.categoria || op.tipo_maquina || 'CNC',
        horas_estimadas: op.horas_estimadas ? String(op.horas_estimadas).replace('.', ',') : '',
        prazo_dias: op.prazo_dias,
        fornecedor: op.fornecedor,
      }))
    );
    setOpenInstructionIdx({});
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleAddFormOperacao = () => {
    const nextSeq =
      formOperacoes.length > 0
        ? Math.max(...formOperacoes.map((o) => o.sequencia)) + 10
        : 10;
    setFormOperacoes((prev) => [
      ...prev,
      {
        id: `mop_${Date.now()}_${Math.random()}`,
        sequencia: nextSeq,
        descricao: '',
        instrucoes: '',
        tipo_maquina: 'CNC',
        horas_estimadas: '4,0',
      },
    ]);
  };

  const handleRemoveFormOperacao = (id: string) => {
    setFormOperacoes((prev) => prev.filter((o) => o.id !== id));
  };

  const handleSaveModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!modeloForm.codigo.trim()) {
      errors.codigo = 'O código do componente-modelo é obrigatório.';
    }
    if (!modeloForm.nome.trim()) {
      errors.nome = 'O nome do componente-modelo é obrigatório.';
    }

    // Valida operações
    const operacoesSanitizadas: ModeloOperacao[] = [];
    formOperacoes.forEach((op, idx) => {
      if (!op.descricao.trim()) {
        errors[`op_desc_${idx}`] = 'Descrição obrigatória';
      }
      if (op.instrucoes && op.instrucoes.length > 5000) {
        errors[`op_inst_${idx}`] = 'Instruções de execução não podem ultrapassar 5.000 caracteres.';
      }
      const maqMatch = maquinas.find(
        (m) =>
          m.categoria === op.tipo_maquina ||
          m.tipo === op.tipo_maquina ||
          m.nome === op.tipo_maquina
      );
      const isTerceiro = maqMatch?.origem === 'terceirizado' || Boolean(op.prazo_dias);
      const rawHoras = String(op.horas_estimadas ?? '').trim().replace(',', '.');
      const horasNum = parseFloat(rawHoras);

      if (!isTerceiro) {
        if (!rawHoras || isNaN(horasNum) || horasNum <= 0) {
          errors[`op_hora_${idx}`] = 'Informe um tempo válido maior que zero (ex: 0,25; 1,5; 37,75; 120).';
        }
      }

      if (!errors[`op_desc_${idx}`] && !errors[`op_hora_${idx}`] && !errors[`op_inst_${idx}`]) {
        operacoesSanitizadas.push({
          id: op.id.startsWith('mop_') ? op.id : `mop_${Date.now()}_${idx}`,
          modelo_componente_id: editingModelo ? editingModelo.id : '',
          sequencia: op.sequencia || (idx + 1) * 10,
          descricao: op.descricao.trim(),
          instrucoes: op.instrucoes?.trim() ? op.instrucoes.slice(0, 5000) : undefined,
          categoria: op.tipo_maquina,
          tipo_maquina: op.tipo_maquina,
          horas_estimadas: !isNaN(horasNum) && horasNum > 0 ? horasNum : 0,
          prazo_dias: op.prazo_dias ?? (isTerceiro ? maqMatch?.prazo_padrao_dias : undefined),
          fornecedor: op.fornecedor ?? (isTerceiro ? maqMatch?.fornecedor_nome : undefined),
        });
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      if (editingModelo) {
        await toolShopService.updateModelo(editingModelo.id, {
          codigo: modeloForm.codigo.trim().toUpperCase(),
          nome: modeloForm.nome.trim(),
          categoria: modeloForm.categoria.trim(),
          material: modeloForm.material.trim(),
          observacoes: modeloForm.observacoes.trim(),
          operacoes: operacoesSanitizadas,
        });
        setFeedback({ type: 'success', message: 'Componente-modelo atualizado com sucesso!' });
      } else {
        await toolShopService.createModelo({
          codigo: modeloForm.codigo.trim().toUpperCase(),
          nome: modeloForm.nome.trim(),
          categoria: modeloForm.categoria.trim(),
          material: modeloForm.material.trim(),
          observacoes: modeloForm.observacoes.trim(),
          operacoes: operacoesSanitizadas,
        });
        setFeedback({ type: 'success', message: 'Novo componente-modelo cadastrado com sucesso!' });
      }

      setIsEditModalOpen(false);
      loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha ao salvar modelo.',
      });
    }
  };

  const handleDeleteModelo = async () => {
    try {
      await toolShopService.deleteModelo(deleteModalState.id);
      setFeedback({
        type: 'success',
        message: `Modelo "${deleteModalState.codigo}" removido da biblioteca.`,
      });
      setDeleteModalState({ isOpen: false, id: '', nome: '', codigo: '' });
      loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha ao excluir modelo.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Feedback */}
      {feedback && (
        <FeedbackAlert
          feedback={feedback}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Cabeçalho da Biblioteca */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Biblioteca de Componentes-Modelo
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                Roteiros técnicos padronizados de usinagem e processos para projetos de moldes e
                estampos
              </p>
            </div>
          </div>
        </div>

        {/* Ações da Biblioteca */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Baixar Planilha Modelo */}
          <button
            type="button"
            onClick={downloadPlanilhaModeloBiblioteca}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-colors"
            title="Baixar planilha Excel (.xlsx) modelo para cadastro de roteiros"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Baixar Planilha Modelo</span>
          </button>

          {/* Botão Importar Roteiros (Restrito a Gerente e Admin) */}
          {canImport && (
            <button
              type="button"
              onClick={() => {
                setImportFile(null);
                setImportGrupos([]);
                setImportErrosGerais([]);
                setIsImportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>Importar Roteiros (Excel)</span>
            </button>
          )}

          {/* Botão Novo Modelo */}
          {canCreate && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-colors"
            >
              <Plus className="h-4 w-4 text-amber-400" />
              <span>Novo Modelo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs da Biblioteca: Componentes-Modelo vs Histórico de Importações */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('modelos')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'modelos'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Componentes-Modelo</span>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {modelos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'historico'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Histórico de Importações</span>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {historico.length}
          </span>
        </button>
      </div>

      {/* TAB 1: LISTA DE COMPONENTES-MODELO */}
      {activeTab === 'modelos' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por código, nome do componente, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                aria-label="Filtrar por Categoria"
                className="rounded-lg border border-slate-300 py-1.5 pl-2.5 pr-8 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
              >
                <option value="Todas">Todas as Categorias</option>
                {categoriasDisponiveis.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Modelos */}
          {filteredModelos.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhum componente-modelo encontrado"
              description={
                searchTerm || selectedCategoria !== 'Todas'
                  ? 'Nenhum resultado corresponde aos filtros aplicados.'
                  : 'A biblioteca ainda não possui modelos cadastrados. Importe roteiros via planilha Excel ou crie manualmente.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredModelos.map((modelo) => {
                const isExpanded = Boolean(expandedModelIds[modelo.id]);
                const totalHoras = modelo.operacoes.reduce(
                  (acc, op) => acc + (op.horas_estimadas || 0),
                  0
                );

                return (
                  <div
                    key={modelo.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-slate-300"
                  >
                    {/* Linha Principal do Modelo */}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        className="flex flex-1 cursor-pointer items-start gap-3"
                        onClick={() => toggleExpand(modelo.id)}
                      >
                        <button
                          type="button"
                          className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={isExpanded ? 'Recolher roteiro' : 'Expandir roteiro'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-slate-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {modelo.codigo}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">{modelo.nome}</h3>
                            {modelo.categoria && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {modelo.categoria}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>
                              Material padrão:{' '}
                              <strong className="text-slate-700">{modelo.material}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Operações:{' '}
                              <strong className="text-slate-700">
                                {modelo.operacoes.length} etapas
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Carga estimada total:{' '}
                              <strong className="text-amber-700">{formatHours(totalHoras)}</strong>
                            </span>
                          </div>

                          {modelo.observacoes && (
                            <p className="mt-1 text-xs text-slate-500 italic">
                              "{modelo.observacoes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação do Modelo */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setFolhaProcessoModelo(modelo)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          title="Visualizar Folha de Processos técnica deste modelo"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          <span>Folha de Processo</span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(modelo)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Editar modelo e roteiro"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteModalState({
                                isOpen: true,
                                id: modelo.id,
                                nome: modelo.nome,
                                codigo: modelo.codigo,
                              })
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Excluir da biblioteca"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detalhe do Roteiro (Expansível) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Roteiro Técnico Padrão ({modelo.operacoes.length} operações)
                        </div>

                        {modelo.operacoes.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Nenhuma operação cadastrada neste roteiro.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="border-b border-slate-200 bg-white text-slate-600 font-semibold">
                                <tr>
                                  <th className="py-2 px-3 w-16">Seq</th>
                                  <th className="py-2 px-3">Operação / Processo</th>
                                  <th className="py-2 px-3 w-36">Centro de Custo</th>
                                  <th className="py-2 px-3 w-28 text-right">Horas Estimadas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {modelo.operacoes.map((op) => {
                                  const isOpInstExpanded = Boolean(expandedModelOpInstructions[op.id]);
                                  return (
                                    <React.Fragment key={op.id}>
                                      <tr className="hover:bg-slate-50/50">
                                        <td className="py-2 px-3 font-mono font-bold text-slate-500">
                                          {op.sequencia}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-900">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>{op.descricao}</span>
                                            {op.instrucoes && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setExpandedModelOpInstructions((prev) => ({
                                                    ...prev,
                                                    [op.id]: !prev[op.id],
                                                  }))
                                                }
                                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200"
                                                title="Ver instruções de fabricação"
                                              >
                                                <FileText className="h-3 w-3 text-slate-500" />
                                                <span>{isOpInstExpanded ? 'Ocultar Instruções' : 'Instruções'}</span>
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                            <Cpu className="h-3 w-3 text-slate-500" />
                                            {op.categoria || op.tipo_maquina}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                          {formatHours(op.horas_estimadas)}
                                        </td>
                                      </tr>
                                      {op.instrucoes && isOpInstExpanded && (
                                        <tr className="bg-slate-50/80">
                                          <td colSpan={4} className="py-2.5 px-4 pl-9">
                                            <div className="rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-800 whitespace-pre-wrap shadow-2xs">
                                              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                Plano de Fabricação / Instruções Técnicas:
                                              </span>
                                              {op.instrucoes}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE IMPORTAÇÕES */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">
              Registros de Auditoria & Cargas de Planilhas
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Rastreabilidade de quem executou a importação, horário, arquivo e total de linhas
              processadas
            </p>
          </div>

          {historico.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhuma importação registrada"
              description="Quando você ou outros gestores realizarem importações de componentes ou roteiros, o histórico ficará gravado aqui."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Data e Hora</th>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Arquivo</th>
                      <th className="py-3 px-4 text-center">Total Linhas</th>
                      <th className="py-3 px-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historico.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {formatDateBR(h.data_hora)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{h.usuario_nome}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {h.tipo === 'componentes_projeto' ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                              Componentes do Projeto
                            </span>
                          ) : (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                              Roteiros da Biblioteca
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">{h.arquivo_nome}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {h.total_linhas}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{h.detalhes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL DE IMPORTAÇÃO DE ROTEIROS PARA A BIBLIOTECA (EXCEL / CSV)
      ===================================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Roteiros Técnicos (Excel / CSV)"
        maxWidth="5xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={importGrupos.length === 0 || isSavingImport}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
            >
              {isSavingImport ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Gravando na Biblioteca...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Confirmar Importação</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Instruções e Botão de Modelo */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="block text-slate-900 font-semibold">Formato esperado da planilha:</strong>
                <p className="mt-0.5 text-slate-600">
                  Uma linha por operação: <strong>Código, Componente, Categoria, Material, Seq, Operação, Centro de custo, Horas</strong>.
                  Linhas com o mesmo <em>Código</em> são agrupadas automaticamente no mesmo componente-modelo.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadPlanilhaModeloBiblioteca}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>Baixar Modelo (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Área de Seleção de Arquivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Selecione o arquivo de planilha (.xlsx ou .csv):
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectFile}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Limite: até 500 linhas e 5 MB. Separador decimal aceita vírgula (,) ou ponto (.).
            </p>
          </div>

          {/* Erros Gerais / Avisos */}
          {importErrosGerais.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Problemas detectados na planilha:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {importErrosGerais.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Spinner de Processamento */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-700" />
              <span>Lendo e agrupando roteiros da planilha...</span>
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO / CONFERÊNCIA ANTES DE GRAVAR */}
          {!isParsing && importGrupos.length > 0 && (
            <div className="space-y-4">
              {/* Barra de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="block text-slate-500">Modelos Lidos</span>
                  <strong className="text-base font-bold text-slate-900">
                    {importGrupos.length}
                  </strong>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                  <span className="block text-emerald-700">Novos Modelos</span>
                  <strong className="text-base font-bold text-emerald-800">
                    {importGrupos.filter((g) => !g.jaExisteNaBiblioteca).length}
                  </strong>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <span className="block text-amber-700">Conflitos (Já existem)</span>
                  <strong className="text-base font-bold text-amber-800">
                    {importGrupos.filter((g) => g.jaExisteNaBiblioteca).length}
                  </strong>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                  <span className="block text-blue-700">Total Operações</span>
                  <strong className="text-base font-bold text-blue-800">
                    {importGrupos.reduce((acc, g) => acc + g.operacoes.length, 0)}
                  </strong>
                </div>
              </div>

              {/* Tabela de Conferência */}
              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-100 font-semibold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Componente-Modelo</th>
                      <th className="py-2.5 px-3">Status / Conflito</th>
                      <th className="py-2.5 px-3">Ação para Existentes</th>
                      <th className="py-2.5 px-3 text-right">Etapas / Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {importGrupos.map((grupo) => {
                      const isExpanded = Boolean(expandedImportRows[grupo.codigo]);

                      return (
                        <React.Fragment key={grupo.codigo}>
                          <tr className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {grupo.codigo}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{grupo.nome}</div>
                              <div className="text-[11px] text-slate-400">
                                {grupo.categoria} • {grupo.material}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {grupo.jaExisteNaBiblioteca ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  Já cadastrado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Novo Modelo
                                </span>
                              )}
                              {grupo.linhasComErro.length > 0 && (
                                <span className="block text-[10px] text-rose-600 mt-0.5 font-medium">
                                  {grupo.linhasComErro.length} erro(s) em linhas
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {grupo.jaExisteNaBiblioteca ? (
                                <select
                                  value={grupo.acaoConflito}
                                  onChange={(e) =>
                                    handleToggleAcaoConflito(
                                      grupo.codigo,
                                      e.target.value as 'atualizar' | 'ignorar'
                                    )
                                  }
                                  className="rounded border border-slate-300 py-1 px-2 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-slate-900"
                                >
                                  <option value="atualizar">Atualizar roteiro existente</option>
                                  <option value="ignorar">Ignorar (não alterar)</option>
                                </select>
                              ) : (
                                <span className="text-[11px] text-slate-400">Criar novo</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedImportRows((prev) => ({
                                    ...prev,
                                    [grupo.codigo]: !prev[grupo.codigo],
                                  }))
                                }
                                className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 hover:text-slate-900"
                              >
                                <span>
                                  {grupo.operacoes.length} ops ({formatHours(grupo.totalHoras)})
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Operações detalhadas expandidas */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={5} className="py-2 px-4">
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                                    Operações do roteiro:
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                    {grupo.operacoes.map((op, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200"
                                      >
                                        <span className="font-mono font-bold text-slate-500 mr-2">
                                          {op.sequencia}
                                        </span>
                                        <span className="flex-1 truncate text-slate-800">
                                          {op.descricao}
                                        </span>
                                        <span className="text-slate-500 text-[10px] ml-2">
                                          [{op.tipo_maquina}]
                                        </span>
                                        <span className="font-mono font-bold text-amber-700 ml-2">
                                          {formatHours(op.horas_estimadas)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {grupo.linhasComErro.length > 0 && (
                                    <div className="mt-2 text-rose-700 text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
                                      <strong>Linhas ignoradas com erro:</strong>
                                      {grupo.linhasComErro.map((err, idx) => (
                                        <div key={idx}>
                                          Linha {err.linhaNumero}: {err.motivo}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* =====================================================================
          MODAL MANUAL: CRIAR / EDITAR COMPONENTE-MODELO
      ===================================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingModelo ? `Editar Modelo: ${editingModelo.codigo}` : 'Novo Componente-Modelo'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveModelo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código do Modelo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={modeloForm.codigo}
                onChange={(e) => setModeloForm({ ...modeloForm, codigo: e.target.value })}
                placeholder="Ex: MOD-PLACA-SUP"
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs uppercase font-mono font-bold text-slate-800 focus:border-slate-900 focus:outline-none"
              />
              {formErrors.codigo && (
                <span className="text-[11px] text-rose-500">{formErrors.codigo}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Componente <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={modeloForm.nome}
                onChange={(e) => setModeloForm({ ...modeloForm, nome: e.target.value })}
                placeholder="Ex: Placa Cavidade Superior"
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              />
              {formErrors.nome && (
                <span className="text-[11px] text-rose-500">{formErrors.nome}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria
              </label>
              <input
                type="text"
                value={modeloForm.categoria}
                onChange={(e) => setModeloForm({ ...modeloForm, categoria: e.target.value })}
                placeholder="Ex: Placas e Bases, Postiços, Punções"
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Material Padrão
              </label>
              <input
                type="text"
                value={modeloForm.material}
                onChange={(e) => setModeloForm({ ...modeloForm, material: e.target.value })}
                placeholder="Ex: Aço P20 Beneficiado"
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações Técnicas
            </label>
            <textarea
              rows={2}
              value={modeloForm.observacoes}
              onChange={(e) => setModeloForm({ ...modeloForm, observacoes: e.target.value })}
              placeholder="Notas sobre tolerâncias, canais de água ou tratamento térmico..."
              className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Roteiro Técnico de Operações */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 uppercase">
                Roteiro de Operações ({formOperacoes.length})
              </span>
              <button
                type="button"
                onClick={handleAddFormOperacao}
                className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar Operação</span>
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {formOperacoes.map((op, idx) => {
                const maqMatch = maquinas.find(
                  (m) =>
                    m.categoria === op.tipo_maquina ||
                    m.tipo === op.tipo_maquina ||
                    m.nome === op.tipo_maquina
                );
                const isTerceiro = maqMatch?.origem === 'terceirizado' || Boolean(op.prazo_dias);
                const isInstOpen = Boolean(openInstructionIdx[idx] || op.instrucoes || formErrors[`op_inst_${idx}`]);

                return (
                  <div
                    key={op.id}
                    className={`rounded-lg border p-2.5 text-xs transition-colors space-y-2 ${
                      isTerceiro ? 'border-purple-200 bg-purple-50/30' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <input
                        type="number"
                        value={op.sequencia}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10) || 10;
                          const copy = [...formOperacoes];
                          copy[idx].sequencia = v;
                          setFormOperacoes(copy);
                        }}
                        className="w-12 rounded border border-slate-300 py-1 px-1 text-center font-mono font-bold"
                        title="Sequência"
                      />

                      <input
                        type="text"
                        placeholder="Descrição da operação"
                        value={op.descricao}
                        onChange={(e) => {
                          const copy = [...formOperacoes];
                          copy[idx].descricao = e.target.value;
                          setFormOperacoes(copy);
                        }}
                        className="flex-1 min-w-[140px] rounded border border-slate-300 py-1 px-2 text-xs"
                      />

                      <select
                        value={op.tipo_maquina}
                        onChange={(e) => {
                          const newTipo = e.target.value as TipoMaquina;
                          const copy = [...formOperacoes];
                          copy[idx].tipo_maquina = newTipo;
                          const matched = maquinas.find(
                            (m) => m.categoria === newTipo || m.tipo === newTipo || m.nome === newTipo
                          );
                          if (matched?.origem === 'terceirizado') {
                            if (!copy[idx].prazo_dias) copy[idx].prazo_dias = matched.prazo_padrao_dias || 5;
                            if (!copy[idx].fornecedor) copy[idx].fornecedor = matched.fornecedor_nome || '';
                          }
                          setFormOperacoes(copy);
                        }}
                        className="w-32 rounded border border-slate-300 py-1 px-1 text-xs"
                      >
                        {TIPOS_MAQUINA_PERMITIDOS.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>

                      {isTerceiro ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              placeholder="Dias"
                              value={op.prazo_dias ?? maqMatch?.prazo_padrao_dias ?? 5}
                              onChange={(e) => {
                                const copy = [...formOperacoes];
                                copy[idx].prazo_dias = parseInt(e.target.value, 10) || undefined;
                                setFormOperacoes(copy);
                              }}
                              className="w-14 rounded border border-purple-300 py-1 px-1 text-center font-mono font-bold text-xs bg-white"
                              title="Prazo em dias para retorno terceirizado"
                            />
                            <span className="text-[10px] text-purple-700 font-semibold">dias</span>
                          </div>

                          <input
                            type="text"
                            placeholder="Fornecedor padrão"
                            value={op.fornecedor ?? ''}
                            onChange={(e) => {
                              const copy = [...formOperacoes];
                              copy[idx].fornecedor = e.target.value;
                              setFormOperacoes(copy);
                            }}
                            className="w-24 rounded border border-purple-200 py-1 px-1.5 text-xs bg-white text-purple-900"
                            title="Fornecedor padrão"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="4,0"
                              value={op.horas_estimadas}
                              onChange={(e) => {
                                const copy = [...formOperacoes];
                                copy[idx].horas_estimadas = e.target.value;
                                setFormOperacoes(copy);
                              }}
                              onBlur={() => {
                                const val = op.horas_estimadas.trim();
                                if (val) {
                                  const num = parseFloat(val.replace(',', '.'));
                                  if (!isNaN(num) && num > 0) {
                                    const copy = [...formOperacoes];
                                    copy[idx].horas_estimadas = String(num).replace('.', ',');
                                    setFormOperacoes(copy);
                                  }
                                }
                              }}
                              className={`w-16 rounded border py-1 px-1.5 text-right font-mono font-bold text-xs ${
                                formErrors[`op_hora_${idx}`] ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                              }`}
                              title="Tempo estimado (horas)"
                            />
                            <span className="text-[10px] text-slate-500">h</span>
                          </div>
                          {formErrors[`op_hora_${idx}`] && (
                            <span
                              className="text-[10px] text-rose-600 mt-0.5 max-w-[120px] truncate"
                              title={formErrors[`op_hora_${idx}`]}
                            >
                              {formErrors[`op_hora_${idx}`]}
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setOpenInstructionIdx((prev) => ({
                            ...prev,
                            [idx]: !prev[idx],
                          }))
                        }
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                          op.instrucoes
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                        }`}
                        title="Adicionar ou editar instruções de execução (Plano de Fabricação)"
                      >
                        <FileText className="h-3 w-3 text-slate-500" />
                        <span>Instruções</span>
                        {op.instrucoes && (
                          <span className="font-mono text-[10px] text-amber-800">
                            ({op.instrucoes.length})
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFormOperacao(op.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600 ml-auto"
                        title="Remover etapa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Campo de Instruções de Execução (Multilinha, até 5.000 caracteres) */}
                    {isInstOpen && (
                      <div className="pt-2 border-t border-slate-200/60 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-semibold text-slate-700 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-slate-500" />
                            <span>Instruções de Execução (Plano de Fabricação):</span>
                          </label>
                          <span
                            className={`font-mono text-[10px] ${
                              (op.instrucoes?.length || 0) > 5000
                                ? 'text-rose-600 font-bold'
                                : (op.instrucoes?.length || 0) > 4500
                                ? 'text-amber-600 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {(op.instrucoes?.length || 0).toLocaleString('pt-BR')} / 5.000 caracteres
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={op.instrucoes || ''}
                          onChange={(e) => {
                            const copy = [...formOperacoes];
                            copy[idx].instrucoes = e.target.value;
                            setFormOperacoes(copy);
                          }}
                          placeholder={`Ex:\nLADO SUPERIOR:\n#CALÇO#\n_facear;\n_usinar contorno pronto;\n_furação de rosca e passagens pronto;`}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed"
                        />
                        {formErrors[`op_inst_${idx}`] && (
                          <span className="text-[11px] text-rose-600 font-semibold block">
                            {formErrors[`op_inst_${idx}`]}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Salvar Modelo
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL FOLHA DE PROCESSOS DO MODELO (PLANO DE FABRICAÇÃO A4 P&B)
      ===================================================================== */}
      {folhaProcessoModelo && (
        <FolhaProcessosModal
          isOpen={Boolean(folhaProcessoModelo)}
          onClose={() => setFolhaProcessoModelo(null)}
          tipo="modelo"
          modelo={folhaProcessoModelo}
          configEmpresa={configEmpresa}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        onConfirm={handleDeleteModelo}
        title="Excluir Componente-Modelo"
        itemName={`${deleteModalState.codigo} - ${deleteModalState.nome}`}
        entityTypeLabel="o componente-modelo da biblioteca"
      />
    </div>
  );
};
