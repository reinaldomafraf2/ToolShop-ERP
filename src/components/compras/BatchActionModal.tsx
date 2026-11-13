import React, { useState } from 'react';
import { Fornecedor, StatusItemCompra } from '../../types';
import { Modal } from '../common/Modal';
import { Clock, CheckCircle2, ShoppingBag, Truck, Building2 } from 'lucide-react';

export type TipoBatchAction = 'solicitado' | 'comprado' | 'recebido' | 'fornecedor';

interface BatchActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: TipoBatchAction;
  selectedCount: number;
  fornecedores: Fornecedor[];
  onConfirm: (dados: {
    status?: StatusItemCompra;
    fornecedorId?: string;
    numero_pedido?: string;
    previsao_entrega?: string;
    data_recebimento?: string;
    nota_fiscal?: string;
  }) => Promise<void>;
}

export const BatchActionModal: React.FC<BatchActionModalProps> = ({
  isOpen,
  onClose,
  tipo,
  selectedCount,
  fornecedores,
  onConfirm,
}) => {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [dataRecebimento, setDataRecebimento] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [notaFiscal, setNotaFiscal] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErro(null);

    try {
      if (tipo === 'solicitado') {
        await onConfirm({ status: 'solicitado' });
      } else if (tipo === 'comprado') {
        await onConfirm({
          status: 'comprado',
          numero_pedido: numeroPedido.trim() || undefined,
          previsao_entrega: previsaoEntrega || undefined,
        });
      } else if (tipo === 'recebido') {
        await onConfirm({
          status: 'recebido',
          data_recebimento: dataRecebimento || undefined,
          nota_fiscal: notaFiscal.trim() || undefined,
        });
      } else if (tipo === 'fornecedor') {
        await onConfirm({
          fornecedorId: fornecedorId || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar ação em lote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles: Record<TipoBatchAction, { title: string; subtitle: string; icon: any }> = {
    solicitado: {
      title: 'Marcar como Solicitado',
      subtitle: `Atualizar o status de ${selectedCount} item(ns) selecionado(s) para "Solicitado"`,
      icon: Clock,
    },
    comprado: {
      title: 'Marcar como Comprado',
      subtitle: `Registrar a compra e prazo de entrega para ${selectedCount} item(ns)`,
      icon: ShoppingBag,
    },
    recebido: {
      title: 'Marcar como Recebido',
      subtitle: `Confirmar o recebimento físico e nota fiscal de ${selectedCount} item(ns)`,
      icon: CheckCircle2,
    },
    fornecedor: {
      title: 'Alterar Fornecedor em Lote',
      subtitle: `Definir ou trocar o fornecedor responsável por ${selectedCount} item(ns)`,
      icon: Building2,
    },
  };

  const currentConfig = titles[tipo];
  const Icon = currentConfig.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            {erro}
          </div>
        )}

        {tipo === 'solicitado' && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 leading-relaxed">
            Esta ação marcará todos os <strong>{selectedCount} item(ns)</strong> selecionados como <strong>Solicitado</strong> com a data de hoje.
          </div>
        )}

        {tipo === 'comprado' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Número do Pedido / Ordem de Compra
              </label>
              <input
                type="text"
                placeholder="Ex: OC-2026-401"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Previsão de Entrega
              </label>
              <input
                type="date"
                value={previsaoEntrega}
                onChange={(e) => setPrevisaoEntrega(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {tipo === 'recebido' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data do Recebimento Físico
              </label>
              <input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Número da Nota Fiscal (NF-e)
              </label>
              <input
                type="text"
                placeholder="Ex: NF 98234"
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {tipo === 'fornecedor' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Selecione o Fornecedor
            </label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="">Nenhum (remover fornecedor)</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} {!f.ativo ? '(Inativo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
          >
            <Icon className="h-4 w-4" />
            <span>{isSubmitting ? 'Aplicando...' : 'Confirmar e Aplicar'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
