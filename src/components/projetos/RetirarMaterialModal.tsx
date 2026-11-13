import React, { useState, useEffect } from 'react';
import {
  ComponenteComOperacoes,
  ProjetoComDetalhes,
  ItemEstoqueComDetalhes,
  ReservaEstoqueComDetalhes,
  UnidadeEstoqueComDetalhes,
} from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import {
  PackageCheck,
  AlertTriangle,
  Layers,
  CheckCircle2,
  BookmarkCheck,
  Scale,
  MapPin,
} from 'lucide-react';

interface RetirarMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  projeto: ProjetoComDetalhes;
  componente: ComponenteComOperacoes;
  onSuccess: (mensagem: string) => void;
}

export const RetirarMaterialModal: React.FC<RetirarMaterialModalProps> = ({
  isOpen,
  onClose,
  projeto,
  componente,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [reservasComponente, setReservasComponente] = useState<ReservaEstoqueComDetalhes[]>([]);
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemEstoqueComDetalhes[]>([]);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<UnidadeEstoqueComDetalhes[]>([]);

  // Origem da retirada: de uma reserva existente ou livre do estoque
  const [origemRetirada, setOrigemRetirada] = useState<'reserva' | 'livre'>('reserva');
  const [selectedReservaId, setSelectedReservaId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedUnidadeId, setSelectedUnidadeId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [observacoes, setObservacoes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isCarregandoDados, setIsCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega reservas do componente e itens disponíveis
  useEffect(() => {
    if (isOpen) {
      setIsCarregandoDados(true);
      setErro(null);

      Promise.all([
        estoqueService.getReservasComDetalhes(projeto.empresa_id),
        estoqueService.getItensComDetalhes(projeto.empresa_id),
        estoqueService.getUnidadesComDetalhes(projeto.empresa_id),
      ])
        .then(([todasReservas, todosItens, todasUnidades]) => {
          // Filtra reservas ativas deste componente
          const resComp = todasReservas.filter(
            (r) => r.status === 'ativa' && r.componente_id === componente.id
          );
          setReservasComponente(resComp);
          setItensDisponiveis(todosItens);
          setUnidadesDisponiveis(todasUnidades.filter((u) => u.status === 'disponivel'));

          if (resComp.length > 0) {
            setOrigemRetirada('reserva');
            setSelectedReservaId(resComp[0].id);
            setQuantidade(String(resComp[0].quantidade || 1));
          } else {
            setOrigemRetirada('livre');
            if (todosItens.length > 0) {
              setSelectedItemId(todosItens[0].id);
            }
            setQuantidade(String(componente.quantidade || 1));
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados para retirada:', err);
          setErro('Falha ao carregar reservas e estoque.');
        })
        .finally(() => {
          setIsCarregandoDados(false);
        });
    }
  }, [isOpen, projeto, componente]);

  if (!isOpen) return null;

  const reservaAtiva = reservasComponente.find((r) => r.id === selectedReservaId);
  const itemAtivo = itensDisponiveis.find((i) => i.id === selectedItemId);
  const isItemFisico = itemAtivo?.tipo_controle === 'unidade_fisica';

  // Unidades físicas disponíveis para o item selecionado
  const unidadesDoItem = unidadesDisponiveis.filter((u) => u.item_id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const qtdNum = Number(quantidade);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      setErro('Informe uma quantidade válida para retirada.');
      return;
    }

    let itemIdParaRetirada = '';
    let unidadeIdParaRetirada: string | undefined;
    let reservaIdParaConsumir: string | undefined;

    if (origemRetirada === 'reserva') {
      if (!selectedReservaId || !reservaAtiva) {
        setErro('Selecione uma reserva de material.');
        return;
      }
      itemIdParaRetirada = reservaAtiva.item_id;
      unidadeIdParaRetirada = reservaAtiva.unidade_id;
      reservaIdParaConsumir = reservaAtiva.id;
    } else {
      if (!selectedItemId) {
        setErro('Selecione o item de estoque a retirar.');
        return;
      }
      itemIdParaRetirada = selectedItemId;
      if (isItemFisico) {
        if (!selectedUnidadeId) {
          setErro('Para peças físicas, selecione a unidade/etiqueta a retirar.');
          return;
        }
        unidadeIdParaRetirada = selectedUnidadeId;
      }
    }

    setIsLoading(true);
    try {
      const res = await estoqueService.retirarMaterialProducao({
        projetoId: projeto.id,
        componenteId: componente.id,
        itemId: itemIdParaRetirada,
        unidadeId: unidadeIdParaRetirada,
        quantidade: qtdNum,
        reservaId: reservaIdParaConsumir,
        usuarioId: user?.id || 'admin',
        usuarioNome: user?.nome || 'Operador',
        observacoes: observacoes.trim() || undefined,
      });

      let msg = `Material retirado com sucesso para produção da peça "${componente.nome}".`;
      if (res.reservaConsumida) {
        msg += ` A reserva vinculada foi marcada como consumida.`;
      }

      onSuccess(msg);
      onClose();
    } catch (err: any) {
      console.error('Erro ao retirar material para produção:', err);
      setErro(err.message || 'Erro ao registrar saída de estoque para produção.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Retirar Material do Estoque para Produção"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {/* Identificação da Peça */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-indigo-950 bg-white px-2 py-0.5 rounded border border-indigo-200">
              {projeto.codigo} · {componente.codigo || 'PEÇA'}
            </span>
            <span className="text-xs font-bold text-indigo-900">
              Qtd necessária: {componente.quantidade} un
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mt-1">{componente.nome}</h4>
          <p className="text-[11px] text-slate-600">
            Material especificado: <strong>{componente.material}</strong>{' '}
            {componente.dimensoes ? `· Dimensões: ${componente.dimensoes}` : ''}
          </p>
        </div>

        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {isCarregandoDados ? (
          <div className="py-8 text-center text-slate-400">Carregando estoque e reservas...</div>
        ) : (
          <>
            {/* Escolha entre Reserva ou Livre */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Origem da Retirada de Material *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrigemRetirada('reserva')}
                  disabled={reservasComponente.length === 0}
                  className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                    origemRetirada === 'reserva'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="h-4 w-4 text-indigo-600" />
                    <span>Material Pré-Reservado ({reservasComponente.length})</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrigemRetirada('livre')}
                  className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                    origemRetirada === 'livre'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    <span>Item Disponível no Estoque</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Painel: Material Reservado */}
            {origemRetirada === 'reserva' && (
              <div className="rounded-xl border border-indigo-200 bg-white p-3 space-y-2">
                <label className="block text-[11px] font-semibold text-indigo-950">
                  Selecione a reserva ativa para esta peça:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {reservasComponente.map((res) => {
                    const isSel = res.id === selectedReservaId;
                    return (
                      <div
                        key={res.id}
                        onClick={() => {
                          setSelectedReservaId(res.id);
                          setQuantidade(String(res.quantidade));
                        }}
                        className={`cursor-pointer rounded-lg border p-2.5 transition-colors ${
                          isSel
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-medium'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">
                            [{res.item?.codigo || 'ESTOQUE'}] {res.item?.descricao}
                          </span>
                          <span className="font-mono text-xs font-bold text-indigo-700">
                            Qtd reservada: {res.quantidade} {res.item?.unidade}
                          </span>
                        </div>
                        {res.unidade && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200">
                              Etiqueta: {res.unidade.etiqueta}
                            </span>
                            {res.unidade.comprimento_mm && (
                              <span>
                                {res.unidade.comprimento_mm} X {res.unidade.largura_mm} X{' '}
                                {res.unidade.espessura_mm} mm
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Painel: Retirada Livre do Estoque */}
            {origemRetirada === 'livre' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Item de Estoque:
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(e.target.value);
                      setSelectedUnidadeId('');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {itensDisponiveis.map((it) => (
                      <option key={it.id} value={it.id}>
                        [{it.codigo}] {it.descricao} · Saldo disp: {it.disponivel} {it.unidade}{' '}
                        ({it.tipo_controle === 'unidade_fisica' ? 'Peça Física' : 'Quantidade'})
                      </option>
                    ))}
                  </select>
                </div>

                {isItemFisico && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Peça Física / Etiqueta Específica:
                    </label>
                    {unidadesDoItem.length === 0 ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
                        Nenhuma peça física disponível em estoque com status 'disponivel' para este item.
                      </div>
                    ) : (
                      <select
                        value={selectedUnidadeId}
                        onChange={(e) => setSelectedUnidadeId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                      >
                        <option value="">Selecione a peça física...</option>
                        {unidadesDoItem.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.etiqueta} · {u.formato || 'BLOCO'} · {u.comprimento_mm}x{u.largura_mm}x{u.espessura_mm}mm ({u.localizacao || 'Almoxarifado'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quantidade e Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade a Retirar *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações da Saída
                </label>
                <input
                  type="text"
                  placeholder="Ex: Entregue ao fresador p/ desbaste"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
            disabled={isLoading || isCarregandoDados}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isLoading ? 'Registrando Retirada...' : 'Confirmar Retirada'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
