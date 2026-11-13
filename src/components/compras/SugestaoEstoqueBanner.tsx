import React, { useState, useEffect } from 'react';
import { ItemCompraComDetalhes, SugestaoEstoqueItem } from '../../types';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import {
  PackageCheck,
  Scissors,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';

interface SugestaoEstoqueBannerProps {
  itemCompra: ItemCompraComDetalhes;
  onAtendidoSucesso: (mensagem: string) => void;
}

export const SugestaoEstoqueBanner: React.FC<SugestaoEstoqueBannerProps> = ({
  itemCompra,
  onAtendidoSucesso,
}) => {
  const { user } = useAuth();
  const [sugestoes, setSugestoes] = useState<SugestaoEstoqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [itemConfirmando, setItemConfirmando] = useState<SugestaoEstoqueItem | null>(null);
  const [isProcessando, setIsProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Não exibe sugestão se já estiver atendido por estoque ou cancelado
  const elegivel =
    itemCompra.status !== 'atendido_estoque' &&
    itemCompra.status !== 'cancelado' &&
    itemCompra.status !== 'recebido' &&
    itemCompra.projeto_id &&
    itemCompra.componente_id;

  useEffect(() => {
    if (elegivel) {
      setIsLoading(true);
      estoqueService
        .procurarAtendimentoEstoque(
          {
            descricao: itemCompra.descricao,
            especificacao: itemCompra.especificacao,
            tipo: itemCompra.tipo,
            quantidadeNecessaria: itemCompra.quantidade,
            material: itemCompra.especificacao,
          },
          itemCompra.empresa_id
        )
        .then((sugs) => setSugestoes(sugs))
        .catch((err) => console.error('Erro ao buscar sugestões no estoque:', err))
        .finally(() => setIsLoading(false));
    } else {
      setSugestoes([]);
    }
  }, [itemCompra.id, itemCompra.status, elegivel]);

  if (!elegivel || sugestoes.length === 0) return null;

  const handleConfirmarAtendimento = async () => {
    if (!itemConfirmando || !itemCompra.projeto_id || !itemCompra.componente_id) return;
    setIsProcessando(true);
    setErro(null);

    try {
      await estoqueService.atenderItemPeloEstoque({
        itemCompraId: itemCompra.id,
        itemId: itemConfirmando.itemId,
        unidadeId: itemConfirmando.unidadeId,
        quantidade: itemCompra.quantidade,
        projetoId: itemCompra.projeto_id,
        componenteId: itemCompra.componente_id,
        usuarioId: user?.id || 'admin',
        usuarioNome: user?.nome || 'Operador',
      });

      const detalhe = itemConfirmando.tipo === 'sobra'
        ? `sobra ${itemConfirmando.etiqueta}`
        : `${itemCompra.quantidade} ${itemCompra.unidade} do item ${itemConfirmando.itemCodigo}`;

      onAtendidoSucesso(`Necessidade de compra atendida pelo estoque com reserva de ${detalhe}.`);
      setItemConfirmando(null);
    } catch (err: any) {
      console.error('Erro ao atender item pelo estoque:', err);
      setErro(err.message || 'Falha ao atender item pelo estoque.');
    } finally {
      setIsProcessando(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-teal-950 text-xs">
            <PackageCheck className="h-4 w-4 text-teal-700" />
            <span>Disponibilidade no Estoque Encontrada</span>
          </div>
          <span className="rounded-full bg-teal-200/80 px-2 py-0.2 font-mono text-[10px] font-bold text-teal-900">
            {sugestoes.length} sugestão(ões)
          </span>
        </div>

        <p className="text-[11px] text-teal-900/80">
          Você pode atender esta necessidade diretamente com materiais ou sobras do almoxarifado, sem precisar comprar no fornecedor:
        </p>

        <div className="space-y-1.5 pt-1">
          {sugestoes.map((sug, idx) => (
            <div
              key={`${sug.itemId}-${sug.unidadeId || idx}`}
              className="flex items-center justify-between rounded-lg border border-teal-200 bg-white p-2 text-xs"
            >
              <div className="min-w-0 pr-2">
                {sug.tipo === 'sobra' ? (
                  <div className="flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">
                        Sobra disponível: etiqueta {sug.etiqueta}
                      </span>
                      <span className="block text-[10px] font-mono text-slate-500">
                        {sug.dimensoes} {sug.localizacao ? `· ${sug.localizacao}` : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">
                        Há {sug.disponivel} {sug.unidade} em estoque
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate">
                        [{sug.itemCodigo}] {sug.itemDescricao}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setItemConfirmando(sug)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-teal-700 transition-colors cursor-pointer"
              >
                <span>Atender pelo estoque</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DO ATENDIMENTO PELO ESTOQUE (Regra 3: Sempre com confirmação) */}
      {itemConfirmando && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Confirmar Atendimento pelo Estoque
                </h3>
                <p className="text-xs text-slate-500">
                  Reserva imediata de material para a peça
                </p>
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{erro}</span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs text-slate-700">
              <div>
                <span className="text-slate-500 font-semibold">Peça / Componente: </span>
                <span className="font-bold text-slate-900">
                  {itemCompra.componente?.nome || 'Peça'} ({itemCompra.projeto?.codigo})
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold">Material a ser reservado: </span>
                <span className="font-bold text-teal-900">
                  {itemConfirmando.tipo === 'sobra'
                    ? `Sobra ${itemConfirmando.etiqueta} (${itemConfirmando.dimensoes})`
                    : `${itemCompra.quantidade} ${itemCompra.unidade} do item [${itemConfirmando.itemCodigo}] ${itemConfirmando.itemDescricao}`}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
                Esta ação criará uma <strong>Reserva de Estoque</strong> exclusiva para este componente e alterará o status da necessidade de compra para <strong>Atendido Estoque</strong>, eliminando a compra no fornecedor.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessando}
                onClick={() => {
                  setItemConfirmando(null);
                  setErro(null);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessando}
                onClick={handleConfirmarAtendimento}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isProcessando ? 'Reservando...' : 'Confirmar e Reservar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
