import React, { useState, useEffect } from 'react';
import { ItemEstoqueComDetalhes } from '../../types';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from '../common/Modal';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Search,
  Check,
} from 'lucide-react';

interface InventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  itens: ItemEstoqueComDetalhes[];
  onSuccess: (mensagem: string) => void;
}

export const InventarioModal: React.FC<InventarioModalProps> = ({
  isOpen,
  onClose,
  itens,
  onSuccess,
}) => {
  const { user } = useAuth();
  // Map de itemId -> quantidade contada (string para input)
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [filtroTexto, setFiltroTexto] = useState('');
  const [somenteDivergentes, setSomenteDivergentes] = useState(false);

  // Etapa de confirmação antes de gravar
  const [isConfirmando, setIsConfirmando] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      itens.forEach((it) => {
        initial[it.id] = String(it.saldo);
      });
      setContagens(initial);
      setFiltroTexto('');
      setSomenteDivergentes(false);
      setIsConfirmando(false);
      setErro(null);
    }
  }, [isOpen, itens]);

  const handleInputChange = (itemId: string, value: string) => {
    setContagens((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  // Itens filtrados para a listagem
  const itensFiltrados = React.useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return itens.filter((it) => {
      const matchText =
        !q ||
        it.codigo.toLowerCase().includes(q) ||
        it.descricao.toLowerCase().includes(q) ||
        (it.localizacao_padrao && it.localizacao_padrao.toLowerCase().includes(q));

      if (!matchText) return false;

      if (somenteDivergentes) {
        const contado = Number(contagens[it.id] ?? it.saldo);
        return contado !== it.saldo;
      }

      return true;
    });
  }, [itens, filtroTexto, somenteDivergentes, contagens]);

  // Lista de itens que possuem divergência entre saldo do sistema e contado
  const itensDivergentes = React.useMemo(() => {
    return itens.filter((it) => {
      const contado = Number(contagens[it.id] ?? it.saldo);
      return !isNaN(contado) && contado !== it.saldo;
    });
  }, [itens, contagens]);

  const handleIniciarGravacao = () => {
    if (itensDivergentes.length === 0) {
      setErro('Nenhuma divergência de contagem foi encontrada em relação ao saldo atual.');
      return;
    }
    setIsConfirmando(true);
  };

  const handleConfirmarGravacao = async () => {
    setIsLoading(true);
    setErro(null);

    try {
      const payload = itensDivergentes.map((it) => ({
        itemId: it.id,
        saldoContado: Math.max(0, Number(contagens[it.id])),
      }));

      const res = await estoqueService.executarInventario(
        payload,
        user?.id || 'admin',
        user?.nome || 'Gestor'
      );

      onSuccess(
        `Inventário finalizado com sucesso! ${res.totalAjustados} item(ns) tiveram seus saldos ajustados.`
      );
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar ajustes do inventário.');
      setIsConfirmando(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inventário Físico de Almoxarifado"
      subtitle="Conferência de quantidades e ajuste atômico de saldos com rastreamento"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* ETAPA 1: DIGITAÇÃO E CONFERÊNCIA */}
        {!isConfirmando ? (
          <>
            {/* Barra de Busca e Filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Filtrar por código, descrição ou localização..."
                  className="pl-9 block w-full rounded-xl border border-slate-300 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={somenteDivergentes}
                    onChange={(e) => setSomenteDivergentes(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Somente divergências ({itensDivergentes.length})</span>
                </label>
              </div>
            </div>

            {/* Tabela de Contagem Física */}
            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item / Código</th>
                    <th className="py-2 px-3 text-center w-24">Saldo Atual</th>
                    <th className="py-2 px-3 text-center w-32">Contagem Física</th>
                    <th className="py-2 px-3 text-center w-28">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Nenhum item encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((it) => {
                      const contadoStr = contagens[it.id] ?? String(it.saldo);
                      const contadoNum = Number(contadoStr);
                      const diferenca = !isNaN(contadoNum) ? contadoNum - it.saldo : 0;

                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            diferenca !== 0 ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{it.codigo}</span>
                            <span className="text-slate-600 truncate block max-w-xs">{it.descricao}</span>
                            <span className="text-[10px] text-slate-400">
                              {it.localizacao_padrao || 'Sem local'} · {it.unidade}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                            {it.saldo} {it.unidade}
                          </td>

                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={contadoStr}
                                onChange={(e) => handleInputChange(it.id, e.target.value)}
                                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-center font-mono font-bold text-slate-900 focus:border-slate-900 focus:ring-slate-900"
                              />
                              <span className="text-[10px] text-slate-500 font-mono">{it.unidade}</span>
                            </div>
                          </td>

                          <td className="py-2 px-3 text-center font-mono font-bold">
                            {diferenca === 0 ? (
                              <span className="text-slate-400 text-[11px]">0 (Ok)</span>
                            ) : diferenca > 0 ? (
                              <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[11px]">
                                +{diferenca} {it.unidade}
                              </span>
                            ) : (
                              <span className="rounded bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 text-[11px]">
                                {diferenca} {it.unidade}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumo do Rodapé */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                {itensDivergentes.length === 0 ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Todas as contagens conferem com o saldo atual do sistema.</span>
                  </span>
                ) : (
                  <span className="text-amber-800 font-semibold">
                    {itensDivergentes.length} item(ns) com discrepância identificada para ajuste.
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleIniciarGravacao}
                  disabled={itensDivergentes.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40"
                >
                  <span>Revisar e Gravar Inventário</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ETAPA 2: CONFIRMAÇÃO OBRIGATÓRIA ANTES DE GRAVAR */
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
                <span>Confirmação de Gravação do Inventário Físico</span>
              </div>
              <p>
                Você está prestes a gerar <strong>{itensDivergentes.length} movimento(s) de ajuste</strong> no estoque.
                Os saldos atuais dos seguintes itens serão atualizados atômica e permanentemente:
              </p>

              <div className="max-h-48 overflow-y-auto space-y-1 mt-2 bg-white/70 rounded-xl p-2.5 border border-amber-200">
                {itensDivergentes.map((it) => {
                  const contado = Number(contagens[it.id]);
                  const diff = contado - it.saldo;
                  return (
                    <div key={it.id} className="flex items-center justify-between text-[11px] font-mono">
                      <span>
                        <strong>{it.codigo}</strong> — {it.descricao}
                      </span>
                      <span>
                        {it.saldo} → <strong>{contado}</strong> ({diff > 0 ? `+${diff}` : diff} {it.unidade})
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-amber-800 pt-1">
                Movimentos de estoque são <strong>imutáveis</strong> e registrados no log de auditoria com motivo
                "inventário".
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsConfirmando(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Voltar e Conferir
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirmarGravacao}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
              >
                {isLoading ? 'Gravando Ajustes...' : 'Confirmar e Atualizar Estoque'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
