import React, { useState, useEffect } from 'react';
import {
  ItemEstoqueComDetalhes,
  MovimentoEstoqueComDetalhes,
  ReservaEstoqueComDetalhes,
  UnidadeEstoqueComDetalhes,
} from '../../types';
import { estoqueService } from '../../services/estoqueService';
import { formatDateTimeBR } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  X,
  Package,
  Layers,
  Clock,
  BookmarkPlus,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  MapPin,
  AlertTriangle,
  Printer,
  Trash2,
  Edit2,
  CheckCircle2,
  Check,
  Ban,
} from 'lucide-react';

interface ItemEstoqueDrawerProps {
  item: ItemEstoqueComDetalhes | null;
  isOpen: boolean;
  onClose: () => void;
  onEditarItem: (item: ItemEstoqueComDetalhes) => void;
  onNovaEntrada: (item: ItemEstoqueComDetalhes) => void;
  onNovaSaida: (item: ItemEstoqueComDetalhes) => void;
  onNovoAjuste: (item: ItemEstoqueComDetalhes) => void;
  onNovaReserva: (item: ItemEstoqueComDetalhes) => void;
  onTransferir: (item: ItemEstoqueComDetalhes) => void;
  onImprimirEtiquetaUnidade: (unidade: UnidadeEstoqueComDetalhes) => void;
  onItemAtualizado: () => void;
  canManage: boolean;
}

export const ItemEstoqueDrawer: React.FC<ItemEstoqueDrawerProps> = ({
  item,
  isOpen,
  onClose,
  onEditarItem,
  onNovaEntrada,
  onNovaSaida,
  onNovoAjuste,
  onNovaReserva,
  onTransferir,
  onImprimirEtiquetaUnidade,
  onItemAtualizado,
  canManage,
}) => {
  const [subAba, setSubAba] = useState<'movimentos' | 'reservas' | 'unidades'>('movimentos');
  const [movimentos, setMovimentos] = useState<MovimentoEstoqueComDetalhes[]>([]);
  const [reservas, setReservas] = useState<ReservaEstoqueComDetalhes[]>([]);
  const [unidades, setUnidades] = useState<UnidadeEstoqueComDetalhes[]>([]);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reservaToCancel, setReservaToCancel] = useState<ReservaEstoqueComDetalhes | null>(null);
  const [isDesativarModalOpen, setIsDesativarModalOpen] = useState(false);
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);

  const loadSubDados = async () => {
    if (!item) return;
    setIsLoadingSub(true);
    try {
      const [allMovs, allRes, allUni] = await Promise.all([
        estoqueService.getMovimentosComDetalhes(),
        estoqueService.getReservasComDetalhes(),
        estoqueService.getUnidadesComDetalhes(),
      ]);

      setMovimentos(allMovs.filter((m) => m.item_id === item.id));
      setReservas(allRes.filter((r) => r.item_id === item.id));
      setUnidades(allUni.filter((u) => u.item_id === item.id));
    } catch (err) {
      console.error('Erro ao carregar detalhes do item:', err);
    } finally {
      setIsLoadingSub(false);
    }
  };

  useEffect(() => {
    if (isOpen && item) {
      loadSubDados();
      setFeedback(null);
      setErroOperacao(null);
    }
  }, [isOpen, item]);

  const handleConfirmCancelarReserva = async () => {
    if (!reservaToCancel) return;
    try {
      await estoqueService.cancelarReserva(reservaToCancel.id);
      setReservaToCancel(null);
      loadSubDados();
      onItemAtualizado();
    } catch (err: any) {
      setErroOperacao(err.message || 'Erro ao cancelar reserva.');
    }
  };

  const handleConfirmExcluir = async () => {
    if (!item) return;
    setIsDeleting(true);
    setErroOperacao(null);
    try {
      await estoqueService.excluirItem(item.id);
      setIsDeleteModalOpen(false);
      onItemAtualizado();
      onClose();
    } catch (err: any) {
      setErroOperacao(err.message || 'Erro ao excluir item.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDesativar = async () => {
    if (!item) return;
    setErroOperacao(null);
    try {
      await estoqueService.desativarItem(item.id);
      setIsDesativarModalOpen(false);
      onItemAtualizado();
      onClose();
    } catch (err: any) {
      setErroOperacao(err.message || 'Erro ao desativar item.');
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl md:max-w-2xl h-full bg-white shadow-2xl flex flex-col z-50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Drawer */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-extrabold text-slate-900">
                  {item.codigo}
                </span>
                {!item.ativo && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                    INATIVO
                  </span>
                )}
                {item.abaixo_minimo && (
                  <span className="rounded bg-rose-100 border border-rose-300 px-2 py-0.2 text-[10px] font-bold text-rose-800">
                    Abaixo do Mínimo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 truncate max-w-sm">{item.descricao}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => onEditarItem(item)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                title="Editar dados cadastrais"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* CARDS DE SALDO E DISPONIBILIDADE */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Saldo Físico
              </span>
              <span className="font-mono text-xl font-extrabold text-slate-900 mt-0.5 block">
                {item.saldo}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{item.unidade}</span>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Reservado
              </span>
              <span className="font-mono text-xl font-extrabold text-amber-950 mt-0.5 block">
                {item.reservado}
              </span>
              <span className="text-[10px] text-amber-700 font-mono">{item.unidade}</span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Disponível
              </span>
              <span className="font-mono text-xl font-extrabold text-emerald-950 mt-0.5 block">
                {item.disponivel}
              </span>
              <span className="text-[10px] text-emerald-700 font-mono">{item.unidade}</span>
            </div>
          </div>

          {/* DADOS ESPECÍFICOS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Categoria</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {item.categoria.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo de Controle</span>
                <span className="font-semibold text-slate-800">
                  {item.tipo_controle === 'unidade_fisica' ? 'Unidade Física Rastreável' : 'Quantidade'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Localização Padrão</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.localizacao_padrao || 'Não informada'}</span>
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Estoque Mínimo</span>
                <span className="font-mono font-bold text-slate-800">
                  {item.estoque_minimo !== undefined ? `${item.estoque_minimo} ${item.unidade}` : '—'}
                </span>
              </div>
            </div>

            {item.especificacao && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Especificação / Dimensões
                </span>
                <p className="text-slate-700 leading-relaxed font-mono text-[11px] mt-0.5">
                  {item.especificacao}
                </p>
              </div>
            )}
          </div>

          {/* BARRA DE AÇÕES RÁPIDAS */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNovaEntrada(item)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <ArrowDownRight className="h-4 w-4 text-emerald-400" />
              <span>Entrada</span>
            </button>

            <button
              type="button"
              onClick={() => onNovaSaida(item)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ArrowUpRight className="h-4 w-4 text-rose-500" />
              <span>Saída</span>
            </button>

            <button
              type="button"
              onClick={() => onNovaReserva(item)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              <BookmarkPlus className="h-4 w-4" />
              <span>Reservar</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => onNovoAjuste(item)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Ajuste</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onTransferir(item)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Mudar Local</span>
            </button>
          </div>

          {/* SUB-ABAS: MOVIMENTOS, RESERVAS E PEÇAS FÍSICAS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setSubAba('movimentos')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  subAba === 'movimentos'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Movimentações ({movimentos.length})
              </button>

              <button
                type="button"
                onClick={() => setSubAba('reservas')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  subAba === 'reservas'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Reservas Ativas ({reservas.filter((r) => r.status === 'ativa').length})
              </button>

              {item.tipo_controle === 'unidade_fisica' && (
                <button
                  type="button"
                  onClick={() => setSubAba('unidades')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                    subAba === 'unidades'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Peças Físicas ({unidades.length})
                </button>
              )}
            </div>

            {/* CONTEÚDO DAS SUB-ABAS */}
            {isLoadingSub ? (
              <div className="py-8 text-center text-xs text-slate-400">Carregando dados...</div>
            ) : subAba === 'movimentos' ? (
              <div className="space-y-2">
                {movimentos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhuma movimentação registrada para este item.
                  </p>
                ) : (
                  movimentos.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                              m.tipo === 'entrada'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : m.tipo === 'saida'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : '±'} {m.quantidade}{' '}
                            {item.unidade}
                          </span>
                          <span className="font-semibold text-slate-800 capitalize">
                            Motivo: {m.motivo}
                          </span>
                          {m.unidade && (
                            <span className="font-mono text-[10px] bg-slate-100 px-1 rounded border border-slate-200">
                              {m.unidade.etiqueta}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Por {m.usuario_nome || 'Usuário'} {m.projeto_codigo ? `· O.S. ${m.projeto_codigo}` : ''}{' '}
                          {m.componente_nome ? `· ${m.componente_nome}` : ''}
                        </span>
                        {(m.item_compra_id || m.numero_pedido || m.nota_fiscal || m.fornecedor_nome) && (
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 inline-block mt-0.5">
                            {[
                              'Origem: Compra',
                              m.numero_pedido ? `Ped. ${m.numero_pedido}` : null,
                              m.nota_fiscal ? `NF ${m.nota_fiscal}` : null,
                              m.fornecedor_nome ? m.fornecedor_nome : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {m.observacoes && (
                          <span className="text-[11px] text-slate-600 italic block">
                            "{m.observacoes}"
                          </span>
                        )}
                      </div>

                      <div className="text-right text-[10px] text-slate-400 font-mono shrink-0">
                        {formatDateTimeBR(m.data_hora)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : subAba === 'reservas' ? (
              <div className="space-y-2">
                {reservas.filter((r) => r.status === 'ativa').length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhuma reserva ativa no momento.</p>
                ) : (
                  reservas
                    .filter((r) => r.status === 'ativa')
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-950 font-mono">
                              {r.quantidade} {item.unidade}
                            </span>
                            {r.projeto_codigo && (
                              <span className="rounded bg-white px-1.5 py-0.5 border border-amber-300 font-mono font-bold text-[10px] text-slate-800">
                                O.S. {r.projeto_codigo}
                              </span>
                            )}
                            {r.componente_nome && (
                              <span className="text-slate-700 font-medium">· {r.componente_nome}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Criada em {formatDateTimeBR(r.criado_em)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReservaToCancel(r)}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Liberar / Cancelar
                        </button>
                      </div>
                    ))
                )}
              </div>
            ) : (
              /* UNIDADES FÍSICAS */
              <div className="space-y-2">
                {unidades.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhuma peça física registrada para este item.
                  </p>
                ) : (
                  unidades.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.etiqueta}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                              u.status === 'disponivel'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : u.status === 'reservada'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {u.status.toUpperCase()}
                          </span>
                          {u.origem === 'sobra' && (
                            <span className="rounded bg-purple-50 text-purple-800 border border-purple-200 px-1 py-0.2 text-[9px] font-bold">
                              RETALHO
                            </span>
                          )}
                        </div>

                        <div className="font-mono text-slate-700 text-[11px]">
                          {u.diametro_mm
                            ? `Ø ${u.diametro_mm} × ${u.comprimento_mm} mm`
                            : `${u.comprimento_mm} × ${u.largura_mm} × ${u.espessura_mm} mm`}{' '}
                          {u.peso_kg ? `· ${u.peso_kg.toFixed(2)} kg` : ''}
                        </div>

                        <span className="text-[10px] text-slate-400 block">
                          Local: {u.localizacao || 'Almoxarifado'}
                          {u.lote_ou_certificado ? ` · Cert/Lote: ${u.lote_ou_certificado}` : ''}
                        </span>
                        {(u.numero_pedido || u.nota_fiscal || u.origem_projeto_codigo) && (
                          <span className="text-[10px] font-mono text-slate-600 block">
                            {[
                              u.origem === 'sobra' ? 'Sobra' : 'Compra',
                              u.numero_pedido ? `Ped. ${u.numero_pedido}` : null,
                              u.nota_fiscal ? `NF ${u.nota_fiscal}` : null,
                              u.origem_projeto_codigo ? `O.S. ${u.origem_projeto_codigo}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onImprimirEtiquetaUnidade(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title="Imprimir Etiqueta da Peça"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Etiqueta</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Drawer com Ações Administrativas */}
        {canManage && (
          <div className="border-t border-slate-200 p-4 bg-slate-50/90 flex items-center justify-between">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-40"
              title="Exclui o item se não houver movimentos registrados"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isDeleting ? 'Excluindo...' : 'Excluir Item'}</span>
            </button>

            {item.ativo && (
              <button
                type="button"
                onClick={() => setIsDesativarModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Ban className="h-4 w-4" />
                <span>Desativar Item</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: Confirmar Cancelar Reserva */}
      <ConfirmDeleteModal
        isOpen={Boolean(reservaToCancel)}
        onClose={() => setReservaToCancel(null)}
        onConfirm={handleConfirmCancelarReserva}
        title="Cancelar Reserva de Estoque"
        itemName={reservaToCancel ? `${reservaToCancel.quantidade} ${item.unidade} ${reservaToCancel.projeto_codigo ? `(O.S. ${reservaToCancel.projeto_codigo})` : ''}` : ''}
        entityTypeLabel="Reserva de Estoque"
        blockedReason={erroOperacao}
      />

      {/* Modal: Confirmar Exclusão de Item */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setErroOperacao(null);
        }}
        onConfirm={handleConfirmExcluir}
        title="Excluir Item de Estoque"
        itemName={`[${item.codigo}] ${item.descricao}`}
        entityTypeLabel="Item de Estoque"
        isDeleting={isDeleting}
        blockedReason={erroOperacao}
      />

      {/* Modal: Confirmar Desativação de Item */}
      <ConfirmDeleteModal
        isOpen={isDesativarModalOpen}
        onClose={() => {
          setIsDesativarModalOpen(false);
          setErroOperacao(null);
        }}
        onConfirm={handleConfirmDesativar}
        title="Desativar Item de Estoque"
        itemName={`[${item.codigo}] ${item.descricao}`}
        entityTypeLabel="Item de Estoque"
        blockedReason={erroOperacao}
      />
    </div>
  );
};
