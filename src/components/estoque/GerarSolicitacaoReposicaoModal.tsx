import React, { useState, useEffect } from 'react';
import { ItemEstoqueComDetalhes, Fornecedor } from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Package,
} from 'lucide-react';

interface GerarSolicitacaoReposicaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  itensAbaixoMinimo: ItemEstoqueComDetalhes[];
  fornecedores: Fornecedor[];
  onSuccess: (mensagem: string) => void;
}

interface LinhaReposicao {
  itemId: string;
  selecionado: boolean;
  codigo: string;
  descricao: string;
  unidade: string;
  disponivel: number;
  estoqueMinimo: number;
  quantidade: number;
  fornecedorId: string;
  observacoes: string;
}

export const GerarSolicitacaoReposicaoModal: React.FC<GerarSolicitacaoReposicaoModalProps> = ({
  isOpen,
  onClose,
  itensAbaixoMinimo,
  fornecedores,
  onSuccess,
}) => {
  const [linhas, setLinhas] = useState<LinhaReposicao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initial: LinhaReposicao[] = itensAbaixoMinimo.map((it) => {
        const min = it.estoque_minimo || 0;
        const disp = it.disponivel;
        const sugerido = Math.max(1, Math.ceil(min - disp));

        return {
          itemId: it.id,
          selecionado: true,
          codigo: it.codigo,
          descricao: it.descricao,
          unidade: it.unidade,
          disponivel: disp,
          estoqueMinimo: min,
          quantidade: sugerido,
          fornecedorId: '',
          observacoes: `Reposição de estoque (abaixo do mínimo de ${min} ${it.unidade})`,
        };
      });
      setLinhas(initial);
      setErro(null);
    }
  }, [isOpen, itensAbaixoMinimo]);

  if (!isOpen) return null;

  const selecionados = linhas.filter((l) => l.selecionado);

  const toggleSelectAll = () => {
    const allSelected = linhas.every((l) => l.selecionado);
    setLinhas(linhas.map((l) => ({ ...l, selecionado: !allSelected })));
  };

  const handleUpdateLinha = (idx: number, updates: Partial<LinhaReposicao>) => {
    setLinhas((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (selecionados.length === 0) {
      setErro('Selecione pelo menos um item para gerar a solicitação de reposição.');
      return;
    }

    const invalidos = selecionados.filter((l) => l.quantidade <= 0 || isNaN(l.quantidade));
    if (invalidos.length > 0) {
      setErro('Informe quantidades válidas maiores que zero para todos os itens selecionados.');
      return;
    }

    setIsLoading(true);
    try {
      const criados = await estoqueService.gerarSolicitacoesReposicao(
        selecionados.map((l) => ({
          itemId: l.itemId,
          quantidade: l.quantidade,
          fornecedorId: l.fornecedorId || undefined,
          observacoes: l.observacoes,
        }))
      );

      onSuccess(
        `${criados.length} solicitação(ões) de compra para reposição gerada(s) com sucesso na aba Compras!`
      );
      onClose();
    } catch (err: any) {
      console.error('Erro ao gerar reposição de compra:', err);
      setErro(err.message || 'Erro ao gerar solicitações de reposição.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerar Solicitação de Compra para Reposição de Estoque"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950">
            <span className="font-bold">
              {itensAbaixoMinimo.length} item(ns) estão com saldo disponível abaixo do estoque mínimo.
            </span>
            <p className="text-[11px] text-amber-900/80 mt-0.5">
              Revise as quantidades sugeridas (Mínimo - Disponível). Os itens serão criados como requisições de compra de tipo <strong>reposição</strong> (sem vínculo com projeto) para cotação e compra pelo departamento de suprimentos.
            </p>
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-bold text-slate-600">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={linhas.length > 0 && linhas.every((l) => l.selecionado)}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 w-32">Código</th>
                <th className="py-2.5 px-3">Descrição do Item</th>
                <th className="py-2.5 px-3 w-20 text-center">Disponível</th>
                <th className="py-2.5 px-3 w-20 text-center">Mínimo</th>
                <th className="py-2.5 px-3 w-28 text-center">Qtd Reposição</th>
                <th className="py-2.5 px-3 w-44">Fornecedor Preferencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {linhas.map((l, idx) => (
                <tr
                  key={l.itemId}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    !l.selecionado ? 'opacity-50 bg-slate-50/40' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={l.selecionado}
                      onChange={(e) => handleUpdateLinha(idx, { selecionado: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{l.codigo}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{l.descricao}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-700 font-bold">
                    {l.disponivel} {l.unidade}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                    {l.estoqueMinimo} {l.unidade}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={l.quantidade}
                        disabled={!l.selecionado}
                        onChange={(e) =>
                          handleUpdateLinha(idx, { quantidade: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500">{l.unidade}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={l.fornecedorId}
                      disabled={!l.selecionado}
                      onChange={(e) => handleUpdateLinha(idx, { fornecedorId: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">(Sem fornecedor)</option>
                      {fornecedores
                        .filter((f) => f.ativo)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-600 font-medium">
            <strong>{selecionados.length}</strong> de {linhas.length} item(ns) selecionado(s) para
            compra
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || selecionados.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{isLoading ? 'Gerando Solicitações...' : 'Gerar Solicitações de Compra'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
