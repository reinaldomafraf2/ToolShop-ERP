import React, { useState, useEffect } from 'react';
import {
  ItemCompraComDetalhes,
  Fornecedor,
  StatusItemCompra,
  TipoItemCompra,
  UnidadeItemCompra,
  ItemEstoqueComDetalhes,
} from '../../types';
import { useAuth } from '../../auth/AuthContext';
import { formatDateBR } from '../../utils/formatters';
import { estoqueService } from '../../services/estoqueService';
import { navigateToEstoqueItem } from '../../utils/estoqueNavigation';
import {
  getQuantidadePendenteItem,
  getQuantidadeRecebidaItem,
  isRecebimentoParcial,
} from '../../utils/materialStatus';
import { SugestaoEstoqueBanner } from './SugestaoEstoqueBanner';
import { DarEntradaRecebimentoModal } from './DarEntradaRecebimentoModal';
import {
  X,
  Save,
  Trash2,
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PackagePlus,
  ExternalLink,
  RotateCcw,
  Tag,
} from 'lucide-react';

interface ItemCompraDetalhesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemCompraComDetalhes | null;
  fornecedores: Fornecedor[];
  onSave: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

export const ItemCompraDetalhesDrawer: React.FC<ItemCompraDetalhesDrawerProps> = ({
  isOpen,
  onClose,
  item,
  fornecedores,
  onSave,
  onDelete,
  onRefresh,
}) => {
  const { user, perfil } = useAuth();
  const canEditAll = perfil === 'gerente' || perfil === 'admin';
  const canViewCustos = perfil === 'gerente' || perfil === 'admin';
  const canEstornar = perfil === 'gerente' || perfil === 'admin';
  const isLider = perfil === 'lider';
  const canDelete = canEditAll || isLider;

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingEstorno, setIsConfirmingEstorno] = useState(false);

  const [formData, setFormData] = useState({
    tipo: 'materia_prima' as TipoItemCompra,
    descricao: '',
    especificacao: '',
    quantidade: 1,
    unidade: 'un' as UnidadeItemCompra,
    peso_kg: '',
    fornecedor_id: '',
    numero_lista: '',
    data_lista: '',
    status: 'a_solicitar' as StatusItemCompra,
    data_solicitacao: '',
    numero_pedido: '',
    previsao_entrega: '',
    data_recebimento: '',
    nota_fiscal: '',
    observacoes: '',
    valor_estimado: '',
    valor_real: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);
  const [itensEstoque, setItensEstoque] = useState<ItemEstoqueComDetalhes[]>([]);

  useEffect(() => {
    if (item) {
      setFormData({
        tipo: item.tipo,
        descricao: item.descricao || '',
        especificacao: item.especificacao || '',
        quantidade: item.quantidade || 1,
        unidade: item.unidade || 'un',
        peso_kg: item.peso_kg !== undefined ? String(item.peso_kg) : '',
        fornecedor_id: item.fornecedor_id || '',
        numero_lista: item.numero_lista || '',
        data_lista: item.data_lista || '',
        status: item.status,
        data_solicitacao: item.data_solicitacao || '',
        numero_pedido: item.numero_pedido || '',
        previsao_entrega: item.previsao_entrega || '',
        data_recebimento: item.data_recebimento || '',
        nota_fiscal: item.nota_fiscal || '',
        observacoes: item.observacoes || '',
        valor_estimado: item.valor_estimado !== undefined ? String(item.valor_estimado) : '',
        valor_real: item.valor_real !== undefined ? String(item.valor_real) : '',
      });
      setErro(null);
      setIsConfirmingDelete(false);
      setIsConfirmingEstorno(false);

      estoqueService
        .getItensComDetalhes(item.empresa_id)
        .then((res) => setItensEstoque(res))
        .catch((e) => console.warn('Erro ao carregar itens de estoque:', e));
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const qtdRecebida = getQuantidadeRecebidaItem(item);
  const qtdPendente = getQuantidadePendenteItem(item);
  const parcial = isRecebimentoParcial(item);
  const podeReceber =
    item.status !== 'recebido' &&
    item.status !== 'atendido_estoque' &&
    item.status !== 'cancelado' &&
    qtdPendente > 0;
  const temEntradaNoEstoque =
    Boolean(item.movimento_entrada_id) ||
    qtdRecebida > 0 ||
    (item.historico_recebimentos || []).some((r) => !r.estornado);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErro(null);
    try {
      const updates: any = {
        status: formData.status,
        data_solicitacao: formData.data_solicitacao.trim() || undefined,
        numero_pedido: formData.numero_pedido.trim() || undefined,
        previsao_entrega: formData.previsao_entrega.trim() || undefined,
        data_recebimento: formData.data_recebimento.trim() || undefined,
        nota_fiscal: formData.nota_fiscal.trim() || undefined,
        observacoes: formData.observacoes.trim() || undefined,
      };

      if (canEditAll) {
        updates.tipo = formData.tipo;
        updates.descricao = formData.descricao.trim();
        updates.especificacao = formData.especificacao.trim();
        updates.quantidade = Number(formData.quantidade) || 1;
        updates.unidade = formData.unidade;
        updates.fornecedor_id = formData.fornecedor_id || undefined;
        updates.numero_lista = formData.numero_lista.trim() || undefined;
        updates.data_lista = formData.data_lista.trim() || undefined;

        if (formData.peso_kg.trim()) {
          const p = parseFloat(formData.peso_kg.replace(',', '.'));
          updates.peso_kg = isNaN(p) ? undefined : p;
        } else {
          updates.peso_kg = undefined;
        }

        if (formData.valor_estimado.trim()) {
          const ve = parseFloat(formData.valor_estimado.replace(',', '.'));
          updates.valor_estimado = isNaN(ve) ? undefined : ve;
        } else {
          updates.valor_estimado = undefined;
        }

        if (formData.valor_real.trim()) {
          const vr = parseFloat(formData.valor_real.replace(',', '.'));
          updates.valor_real = isNaN(vr) ? undefined : vr;
        } else {
          updates.valor_real = undefined;
        }
      }

      await onSave(item.id, updates);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar item de compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDelete = async () => {
    setIsSubmitting(true);
    setErro(null);
    try {
      await onDelete(item.id);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir item de compra.');
      setIsSubmitting(false);
    }
  };

  const handleExecuteEstorno = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setErro(null);
    try {
      await estoqueService.estornarRecebimentoItemCompra(
        item.id,
        { id: user.id, nome: user.nome, perfil: user.perfil },
        item.empresa_id
      );
      setIsConfirmingEstorno(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao estornar recebimento.');
      setIsConfirmingEstorno(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Cabeçalho do Drawer */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {item.projeto?.codigo || 'REPOSIÇÃO / ESTOQUE'}
              </span>
              {item.componente?.nome && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-bold text-slate-700">
                    {item.componente.nome}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Detalhes da Necessidade de Compra
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-800">
          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {item.atrasado && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 flex items-center gap-2.5 text-rose-900 font-semibold">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <span>Item com entrega atrasada em {item.diasAtraso} dia(s)!</span>
                <span className="block text-[11px] font-normal text-rose-700">
                  Previsão de entrega cadastrada: {item.previsao_entrega ? formatDateBR(item.previsao_entrega) : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Sugestão de Atendimento Imediato pelo Estoque / Sobras */}
          <SugestaoEstoqueBanner
            itemCompra={item}
            onAtendidoSucesso={() => {
              if (onRefresh) onRefresh();
              onClose();
            }}
          />

          {/* 1. SEÇÃO DE STATUS, RECEBIMENTO E RASTREIO NO ESTOQUE */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-600" />
                <span>Fluxo de Aquisição & Recebimento</span>
              </h3>
              {parcial && (
                <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                  Recebido {qtdRecebida} de {item.quantidade} {item.unidade}
                </span>
              )}
            </div>

            {/* Rastro de entrada no estoque + etiquetas + link */}
            {temEntradaNoEstoque && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>
                      Entrou no estoque ({qtdRecebida} de {item.quantidade} {item.unidade})
                    </span>
                  </div>
                  {item.item_estoque_id && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigateToEstoqueItem(item.item_estoque_id!);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <span>Ver no Estoque</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {item.etiquetas_criadas && item.etiquetas_criadas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-emerald-800">Etiquetas:</span>
                    {item.etiquetas_criadas.map((et) => (
                      <span
                        key={et}
                        className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-900"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {et}
                      </span>
                    ))}
                  </div>
                )}

                {item.historico_recebimentos && item.historico_recebimentos.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-emerald-200/70">
                    {item.historico_recebimentos.map((rec) => (
                      <div
                        key={rec.id}
                        className={`flex items-center justify-between text-[10px] px-2 py-1 rounded ${
                          rec.estornado ? 'bg-rose-50 text-rose-700 line-through' : 'bg-white/80 text-emerald-900'
                        }`}
                      >
                        <span>
                          {formatDateBR(rec.data_recebimento)} · <strong>{rec.quantidade} {item.unidade}</strong>
                          {rec.nota_fiscal ? ` · NF ${rec.nota_fiscal}` : ''}
                        </span>
                        <span className="text-slate-500">
                          {rec.estornado ? 'Estornado' : rec.usuario_nome || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Estornar recebimento (Gerente e Admin) */}
                {canEstornar && (
                  <div className="pt-1 border-t border-emerald-200/70">
                    {isConfirmingEstorno ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2">
                        <span className="text-[11px] font-bold text-rose-900">
                          Gerar movimento inverso e restaurar item para pendente?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleExecuteEstorno}
                            disabled={isSubmitting}
                            className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Estornando...' : 'Confirmar Estorno'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingEstorno(false)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-emerald-800/80">
                          {item.pode_estornar
                            ? 'Precisa reverter? Estorne antes da retirada na produção.'
                            : item.motivo_bloqueio_estorno || 'Estorno indisponível.'}
                        </span>
                        <button
                          type="button"
                          disabled={!item.pode_estornar || isSubmitting}
                          onClick={() => setIsConfirmingEstorno(true)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Estornar Recebimento</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Botão principal de Receber (abre modal atômico; funciona inclusive para saldo restante de parciais) */}
            {podeReceber && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <PackagePlus className="h-4 w-4 text-indigo-700" />
                    {parcial ? `Receber Saldo Pendente (${qtdPendente} ${item.unidade})` : 'Receber e Dar Entrada no Estoque'}
                  </span>
                  <span className="block text-[11px] text-indigo-800/80">
                    Registra entrada, etiquetas físicas, reserva e libera material para a produção.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEntradaModalOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  <span>Receber</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Status Atual
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusItemCompra })}
                  disabled={item.status === 'recebido'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
                >
                  <option value="a_solicitar">A solicitar</option>
                  <option value="solicitado">Solicitado</option>
                  <option value="comprado">Comprado</option>
                  {item.status === 'recebido' && <option value="recebido">Recebido</option>}
                  <option value="atendido_estoque">Atendido em Estoque</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data de Solicitação
                </label>
                <input
                  type="date"
                  value={formData.data_solicitacao}
                  onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nº do Pedido / Ordem de Compra
                </label>
                <input
                  type="text"
                  placeholder="Ex: PC-2026-089"
                  value={formData.numero_pedido}
                  onChange={(e) => setFormData({ ...formData, numero_pedido: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Previsão de Entrega
                </label>
                <input
                  type="date"
                  value={formData.previsao_entrega}
                  onChange={(e) => setFormData({ ...formData, previsao_entrega: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data de Recebimento
                </label>
                <input
                  type="date"
                  value={formData.data_recebimento}
                  onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nota Fiscal (NF-e)
                </label>
                <input
                  type="text"
                  placeholder="Ex: NF 14592"
                  value={formData.nota_fiscal}
                  onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          {/* 2. DADOS DO ITEM E ESPECIFICAÇÃO TÉCNICA */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span>Especificação Técnica do Material</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tipo de Item
                </label>
                <select
                  disabled={!canEditAll}
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoItemCompra })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="materia_prima">Matéria-Prima (Bloco / Aço)</option>
                  <option value="item_comercial">Item Comercial / Componente Padrão</option>
                  <option value="reposicao">Reposição de Estoque</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fornecedor
                </label>
                <select
                  disabled={!canEditAll}
                  value={formData.fornecedor_id}
                  onChange={(e) => setFormData({ ...formData, fornecedor_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Sem fornecedor definido</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} {!f.ativo ? '(Inativo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Descrição do Item
              </label>
              <input
                disabled={!canEditAll}
                type="text"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Especificação Completa (Material, Formato e Dimensões)
              </label>
              <textarea
                disabled={!canEditAll}
                rows={2}
                value={formData.especificacao}
                onChange={(e) => setFormData({ ...formData, especificacao: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Quantidade
                </label>
                <input
                  disabled={!canEditAll}
                  type="number"
                  min="0.01"
                  step="any"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unidade
                </label>
                <select
                  disabled={!canEditAll}
                  value={formData.unidade}
                  onChange={(e) => setFormData({ ...formData, unidade: e.target.value as UnidadeItemCompra })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs uppercase font-mono text-slate-900 disabled:bg-slate-100"
                >
                  <option value="un">un</option>
                  <option value="pç">pç</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Peso Unit. (kg)
                </label>
                <input
                  disabled={!canEditAll}
                  type="text"
                  placeholder="Ex: 212,70"
                  value={formData.peso_kg}
                  onChange={(e) => setFormData({ ...formData, peso_kg: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nº da Lista de Materiais
                </label>
                <input
                  disabled={!canEditAll}
                  type="text"
                  placeholder="Ex: LST-01"
                  value={formData.numero_lista}
                  onChange={(e) => setFormData({ ...formData, numero_lista: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data da Lista
                </label>
                <input
                  disabled={!canEditAll}
                  type="date"
                  value={formData.data_lista}
                  onChange={(e) => setFormData({ ...formData, data_lista: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Observações
              </label>
              <textarea
                rows={2}
                placeholder="Instruções de corte, fornecedor específico, certificado de qualidade..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* 3. SEÇÃO FINANCEIRA (RESTRITA A GERENTE E ADMIN) */}
          {canViewCustos && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-700" />
                <span>Valores Financeiros (Restrito a Gerente & Admin)</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-blue-900 mb-1">
                    Valor Estimado / Orçado (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1540,00"
                    value={formData.valor_estimado}
                    onChange={(e) => setFormData({ ...formData, valor_estimado: e.target.value })}
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-900 mb-1">
                    Valor Real Efetivo (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1490,50"
                    value={formData.valor_real}
                    onChange={(e) => setFormData({ ...formData, valor_real: e.target.value })}
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono text-xs font-bold text-emerald-700 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ações do Formulário */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {isConfirmingDelete ? (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 animate-in fade-in">
                <span className="text-[11px] font-bold text-rose-800">Confirmar exclusão?</span>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isSubmitting}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            ) : canDelete ? (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 transition-colors"
                title="Excluir esta necessidade de compra"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir Item</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de Receber e Dar Entrada no Estoque */}
      {isEntradaModalOpen && (
        <DarEntradaRecebimentoModal
          isOpen={isEntradaModalOpen}
          onClose={() => setIsEntradaModalOpen(false)}
          itemCompra={item}
          itensEstoque={itensEstoque}
          onSuccess={() => {
            setIsEntradaModalOpen(false);
            if (onRefresh) onRefresh();
            onClose();
          }}
        />
      )}
    </div>
  );
};
