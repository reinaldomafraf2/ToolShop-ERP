import React, { useState } from 'react';
import { PreviaGeracaoNecessidades } from '../../services/comprasService';
import { Modal } from '../common/Modal';
import {
  Sparkles,
  CheckSquare,
  Square,
  AlertCircle,
  Plus,
  Check,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface GerarNecessidadesModalProps {
  isOpen: boolean;
  onClose: () => void;
  previa: PreviaGeracaoNecessidades | null;
  onConfirm: (
    itensConfirmados: any[],
    fornecedoresParaCadastrar: string[]
  ) => Promise<void>;
}

export const GerarNecessidadesModal: React.FC<GerarNecessidadesModalProps> = ({
  isOpen,
  onClose,
  previa,
  onConfirm,
}) => {
  if (!isOpen || !previa) return null;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(previa.novos.map((n) => n.tempId))
  );

  const [fornecedoresSelecionadosParaCriar, setFornecedoresSelecionadosParaCriar] = useState<
    Set<string>
  >(() => new Set(previa.fornecedoresSugeridosParaCriar));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.size === previa.novos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previa.novos.map((n) => n.tempId)));
    }
  };

  const toggleItem = (tempId: string) => {
    const next = new Set(selectedIds);
    if (next.has(tempId)) {
      next.delete(tempId);
    } else {
      next.add(tempId);
    }
    setSelectedIds(next);
  };

  const toggleFornecedorCriar = (nome: string) => {
    const next = new Set(fornecedoresSelecionadosParaCriar);
    if (next.has(nome)) {
      next.delete(nome);
    } else {
      next.add(nome);
    }
    setFornecedoresSelecionadosParaCriar(next);
  };

  const handleConfirmar = async () => {
    const itensSelecionados = previa.novos
      .filter((n) => selectedIds.has(n.tempId))
      .map((n) => n.item);

    if (itensSelecionados.length === 0) {
      setErro('Selecione pelo menos um item para gerar.');
      return;
    }

    setIsSubmitting(true);
    setErro(null);
    try {
      await onConfirm(
        itensSelecionados,
        Array.from(fornecedoresSelecionadosParaCriar)
      );
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar necessidades de compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Gerar Necessidades de Compra · ${previa.projeto.codigo}`}
      subtitle="Conferência automatizada de matéria-prima e itens comerciais (Idempotente)"
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs text-slate-800">
        {/* Resumo da Validação Idempotente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Novas Necessidades Identificadas
              </span>
              <span className="text-xl font-bold font-mono text-emerald-950">
                {previa.novos.length} itens a gerar
              </span>
            </div>
            <Sparkles className="h-7 w-7 text-emerald-600" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Itens Já Existentes (Protegidos)
              </span>
              <span className="text-xl font-bold font-mono text-slate-800">
                {previa.existentesCount} já criados
              </span>
            </div>
            <Check className="h-7 w-7 text-slate-400" />
          </div>
        </div>

        {erro && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Sugestão de Fornecedores Faltantes */}
        {previa.fornecedoresSugeridosParaCriar.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <Plus className="h-4 w-4 text-amber-700" />
              <span>Fornecedores não cadastrados encontrados nas peças:</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Marque os fornecedores que deseja cadastrar automaticamente durante a geração:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {previa.fornecedoresSugeridosParaCriar.map((nomeForn) => {
                const isChecked = fornecedoresSelecionadosParaCriar.has(nomeForn);
                return (
                  <button
                    key={nomeForn}
                    type="button"
                    onClick={() => toggleFornecedorCriar(nomeForn)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                      isChecked
                        ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-2xs'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="h-3.5 w-3.5 text-amber-800" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span>{nomeForn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabela de Conferência com Checkboxes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              {selectedIds.size === previa.novos.length ? (
                <CheckSquare className="h-4 w-4 text-slate-900" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>Selecionar Todos ({selectedIds.size} de {previa.novos.length})</span>
            </button>
            <span className="text-[11px] text-slate-500">
              Desmarque as linhas que não deseja gerar agora
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            {previa.novos.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Check className="mx-auto h-8 w-8 text-emerald-600 mb-1" />
                <p className="font-semibold text-slate-800">
                  Todas as necessidades de compra deste projeto já foram geradas!
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nenhum componente novo ou matéria-prima pendente de requisição.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                    <th className="py-2.5 px-3 w-28">Código / Peça</th>
                    <th className="py-2.5 px-3 w-28">Tipo</th>
                    <th className="py-2.5 px-3">Especificação Técnica</th>
                    <th className="py-2.5 px-3 w-16 text-center">Qtd</th>
                    <th className="py-2.5 px-3 w-32">Fornecedor</th>
                    <th className="py-2.5 px-3 w-24 text-center">Status Inicial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previa.novos.map((n) => {
                    const isSelected = selectedIds.has(n.tempId);
                    return (
                      <tr
                        key={n.tempId}
                        onClick={() => toggleItem(n.tempId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'opacity-60 hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // tratado no tr
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {n.componenteCodigo && (
                            <span className="block font-mono text-[10px] text-slate-500">
                              {n.componenteCodigo}
                            </span>
                          )}
                          <span>{n.componenteNome}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              n.item.tipo === 'materia_prima'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {n.item.tipo === 'materia_prima' ? 'Matéria-Prima' : 'Item Comercial'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                          {n.item.especificacao}
                          {n.item.peso_kg !== undefined && (
                            <span className="block text-[10px] text-slate-400 font-sans">
                              Peso est.: {n.item.peso_kg} kg
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                          {n.item.quantidade} {n.item.unidade}
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          {n.fornecedorNomeOriginal ? (
                            <span className="font-semibold text-slate-800">
                              {n.fornecedorNomeOriginal}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">A definir</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              n.item.status === 'atendido_estoque'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {n.item.status === 'atendido_estoque' ? 'Estoque' : 'A solicitar'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isSubmitting || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isSubmitting
                ? 'Gravando necessidades...'
                : `Gerar ${selectedIds.size} Necessidade(s)`}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
