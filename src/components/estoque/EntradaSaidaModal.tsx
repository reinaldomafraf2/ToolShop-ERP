import React, { useState, useEffect } from 'react';
import {
  ItemEstoqueComDetalhes,
  UnidadeEstoque,
  ProjetoComDetalhes,
  MotivoMovimentoEstoque,
} from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import {
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  BookmarkPlus,
  MapPin,
  AlertTriangle,
  FolderKanban,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export type TipoOperacaoEstoque =
  | 'entrada'
  | 'saida'
  | 'ajuste'
  | 'reserva'
  | 'transferir';

interface EntradaSaidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipoOperacao: TipoOperacaoEstoque;
  itemSelecionado?: ItemEstoqueComDetalhes | null;
  itensDisponiveis: ItemEstoqueComDetalhes[];
  projetos: ProjetoComDetalhes[];
  onSuccess: (mensagem: string) => void;
}

export const EntradaSaidaModal: React.FC<EntradaSaidaModalProps> = ({
  isOpen,
  onClose,
  tipoOperacao,
  itemSelecionado,
  itensDisponiveis,
  projetos,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [itemId, setItemId] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [motivo, setMotivo] = useState<MotivoMovimentoEstoque>('compra');
  const [observacoes, setObservacoes] = useState('');

  // Vinculação com Projeto e Componente (para saída e reserva)
  const [projetoId, setProjetoId] = useState('');
  const [componenteId, setComponenteId] = useState('');

  // Para itens de unidade física
  const [unidadeId, setUnidadeId] = useState('');
  const [formato, setFormato] = useState('BLOCO');
  const [material, setMaterial] = useState('');
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [espessura, setEspessura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [peso, setPeso] = useState('');
  const [lote, setLote] = useState('');
  const [localizacao, setLocalizacao] = useState('');

  // Para ajuste
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'saida'>('entrada');

  // Para transferência
  const [novaLocalizacao, setNovaLocalizacao] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const itemAtivo = itensDisponiveis.find((i) => i.id === itemId) || itemSelecionado || null;

  useEffect(() => {
    if (itemSelecionado) {
      setItemId(itemSelecionado.id);
      setMaterial(itemSelecionado.especificacao || '');
      setLocalizacao(itemSelecionado.localizacao_padrao || '');
      setNovaLocalizacao(itemSelecionado.localizacao_padrao || '');
    } else if (itensDisponiveis.length > 0) {
      setItemId(itensDisponiveis[0].id);
      setMaterial(itensDisponiveis[0].especificacao || '');
      setLocalizacao(itensDisponiveis[0].localizacao_padrao || '');
      setNovaLocalizacao(itensDisponiveis[0].localizacao_padrao || '');
    }
    setQuantidade('1');
    setObservacoes('');
    setProjetoId('');
    setComponenteId('');
    setUnidadeId('');
    setErro(null);

    // Ajusta motivo padrão conforme operação
    if (tipoOperacao === 'entrada') setMotivo('compra');
    else if (tipoOperacao === 'saida') setMotivo('producao');
    else if (tipoOperacao === 'ajuste') setMotivo('inventario');
  }, [itemSelecionado, itensDisponiveis, tipoOperacao, isOpen]);

  // Componentes do projeto selecionado
  const componentesDoProjeto = React.useMemo(() => {
    if (!projetoId) return [];
    const proj = projetos.find((p) => p.id === projetoId);
    return proj?.componentes || [];
  }, [projetoId, projetos]);

  // Unidades físicas disponíveis do item ativo
  const unidadesDisponiveisItem = React.useMemo(() => {
    if (!itemAtivo || !itemAtivo.unidades_disponiveis) return [];
    return itemAtivo.unidades_disponiveis;
  }, [itemAtivo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!itemAtivo) {
      setErro('Selecione um item de estoque.');
      return;
    }

    const qtdNum = Math.abs(Number(quantidade));
    if (tipoOperacao !== 'transferir' && (isNaN(qtdNum) || qtdNum <= 0)) {
      setErro('Informe uma quantidade válida e maior que zero.');
      return;
    }

    setIsLoading(true);
    try {
      const usuarioId = user?.id || 'admin';
      const usuarioNome = user?.nome || 'Operador / Líder';

      if (tipoOperacao === 'entrada') {
        await estoqueService.registrarEntrada({
          itemId: itemAtivo.id,
          quantidade: qtdNum,
          usuarioId,
          usuarioNome,
          motivo,
          observacoes: observacoes.trim() || undefined,
          dadosUnidadeFisica:
            itemAtivo.tipo_controle === 'unidade_fisica'
              ? {
                  material: material.trim() || itemAtivo.especificacao,
                  formato,
                  comprimento_mm: comprimento ? Number(comprimento) : undefined,
                  largura_mm: largura ? Number(largura) : undefined,
                  espessura_mm: espessura ? Number(espessura) : undefined,
                  diametro_mm: diametro ? Number(diametro) : undefined,
                  peso_kg: peso ? Number(peso) : undefined,
                  localizacao: localizacao.trim() || itemAtivo.localizacao_padrao,
                  lote_ou_certificado: lote.trim() || undefined,
                }
              : undefined,
        });
        onSuccess(`Entrada de ${qtdNum} ${itemAtivo.unidade} de ${itemAtivo.codigo} registrada com sucesso.`);
      } else if (tipoOperacao === 'saida') {
        await estoqueService.registrarSaida({
          itemId: itemAtivo.id,
          quantidade: itemAtivo.tipo_controle === 'unidade_fisica' ? 1 : qtdNum,
          usuarioId,
          usuarioNome,
          motivo,
          observacoes: observacoes.trim() || undefined,
          projetoId: projetoId || undefined,
          componenteId: componenteId || undefined,
          unidadeId: itemAtivo.tipo_controle === 'unidade_fisica' ? unidadeId : undefined,
        });
        onSuccess(`Saída de ${qtdNum} ${itemAtivo.unidade} de ${itemAtivo.codigo} registrada com sucesso.`);
      } else if (tipoOperacao === 'ajuste') {
        await estoqueService.registrarAjuste({
          itemId: itemAtivo.id,
          quantidadeAjuste: qtdNum,
          tipo: tipoAjuste,
          motivo: motivo || 'inventario',
          observacoes: observacoes.trim() || 'Ajuste manual de estoque',
          usuarioId,
          usuarioNome,
        });
        onSuccess(
          `Ajuste (${tipoAjuste === 'entrada' ? '+' : '-'}${qtdNum} ${itemAtivo.unidade}) registrado com sucesso.`
        );
      } else if (tipoOperacao === 'reserva') {
        await estoqueService.criarReserva({
          itemId: itemAtivo.id,
          quantidade: qtdNum,
          projetoId: projetoId || undefined,
          componenteId: componenteId || undefined,
          unidadeId: itemAtivo.tipo_controle === 'unidade_fisica' ? unidadeId : undefined,
        });
        onSuccess(`Reserva de ${qtdNum} ${itemAtivo.unidade} criada para o projeto.`);
      } else if (tipoOperacao === 'transferir') {
        if (!novaLocalizacao.trim()) {
          throw new Error('Informe a nova localização física no almoxarifado.');
        }
        await estoqueService.transferirLocalizacao({
          itemId: itemAtivo.id,
          unidadeId: itemAtivo.tipo_controle === 'unidade_fisica' ? unidadeId : undefined,
          novaLocalizacao: novaLocalizacao.trim(),
          usuarioId,
          usuarioNome,
        });
        onSuccess(`Localização atualizada para "${novaLocalizacao.trim()}".`);
      }

      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar operação de estoque.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitulo = () => {
    switch (tipoOperacao) {
      case 'entrada':
        return 'Registrar Entrada no Estoque';
      case 'saida':
        return 'Registrar Saída de Material / Consumo';
      case 'ajuste':
        return 'Ajuste Manual de Saldo';
      case 'reserva':
        return 'Reservar Material para Projeto/Peça';
      case 'transferir':
        return 'Transferir Localização no Almoxarifado';
    }
  };

  const getSubtitulo = () => {
    switch (tipoOperacao) {
      case 'entrada':
        return 'Adiciona saldo ou novas unidades físicas com rastreabilidade';
      case 'saida':
        return 'Debita quantidade do estoque para uso em projetos ou baixas';
      case 'ajuste':
        return 'Gera movimento corretivo e atualiza saldo atômico';
      case 'reserva':
        return 'Compromete saldo disponível sem dar saída física imediata';
      case 'transferir':
        return 'Atualiza o endereço de prateleira, baia ou armário';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitulo()} subtitle={getSubtitulo()} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Seleção do Item */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Item de Estoque <span className="text-rose-500">*</span>
          </label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            disabled={Boolean(itemSelecionado)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900 font-mono"
          >
            {itensDisponiveis.map((it) => (
              <option key={it.id} value={it.id}>
                {it.codigo} — {it.descricao} (Saldo: {it.saldo} {it.unidade} | Disp: {it.disponivel} {it.unidade})
              </option>
            ))}
          </select>
        </div>

        {/* Resumo do Item Ativo */}
        {itemAtivo && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900">{itemAtivo.descricao}</span>
              <span className="text-[11px] text-slate-500 block">
                Controle: {itemAtivo.tipo_controle === 'unidade_fisica' ? 'Unidade Física' : 'Quantidade'} · Local:{' '}
                {itemAtivo.localizacao_padrao || 'Almoxarifado'}
              </span>
            </div>
            <div className="text-right font-mono">
              <span className="font-bold text-slate-900 text-sm">
                Saldo: {itemAtivo.saldo} {itemAtivo.unidade}
              </span>
              <span className="block text-[11px] text-blue-700 font-semibold">
                Disponível: {itemAtivo.disponivel} {itemAtivo.unidade}
              </span>
            </div>
          </div>
        )}

        {/* OPERAÇÃO: ENTRADA COM UNIDADE FÍSICA */}
        {tipoOperacao === 'entrada' && itemAtivo?.tipo_controle === 'unidade_fisica' && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wide block">
              Dados da Peça Física (Bloco / Barra)
            </span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Formato</label>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="BLOCO">Bloco Retangular</option>
                  <option value="BARRA_REDONDA">Barra Redonda / Tarugo</option>
                  <option value="CHAPA">Chapa Plana</option>
                  <option value="BARRA_CHATA">Barra Chata</option>
                  <option value="TUBO">Tubo Mecânico</option>
                  <option value="OUTRO">Outro Formato</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Material / Aço</label>
                <input
                  type="text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="Ex: Aço P20, H13, 1045, Alumínio 7075"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            {formato === 'BARRA_REDONDA' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Diâmetro (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={diametro}
                    onChange={(e) => setDiametro(e.target.value)}
                    placeholder="Ø em milímetros"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Comprimento (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={comprimento}
                    onChange={(e) => setComprimento(e.target.value)}
                    placeholder="Comprimento"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Compr. (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={comprimento}
                    onChange={(e) => setComprimento(e.target.value)}
                    placeholder="C"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Largura (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={largura}
                    onChange={(e) => setLargura(e.target.value)}
                    placeholder="L"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Espessura (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={espessura}
                    onChange={(e) => setEspessura(e.target.value)}
                    placeholder="E"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Peso (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  placeholder="kg"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Localização</label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={(e) => setLocalizacao(e.target.value)}
                  placeholder="Ex: Prateleira B-03"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Lote / Corrida</label>
                <input
                  type="text"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Certificado / Lote"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* OPERAÇÃO: SAÍDA OU RESERVA PARA UNIDADE FÍSICA (SELEÇÃO DA PEÇA) */}
        {(tipoOperacao === 'saida' || tipoOperacao === 'reserva') &&
          itemAtivo?.tipo_controle === 'unidade_fisica' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Selecione a Peça / Unidade Física a consumir <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 font-mono"
              >
                <option value="">Selecione uma peça disponível...</option>
                {unidadesDisponiveisItem.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.etiqueta} —{' '}
                    {u.diametro_mm
                      ? `Ø ${u.diametro_mm} x ${u.comprimento_mm}mm`
                      : `${u.comprimento_mm}x${u.largura_mm}x${u.espessura_mm}mm`}{' '}
                    · Local: {u.localizacao || 'Almoxarifado'} {u.origem === 'sobra' ? '(SOBRA)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

        {/* Quantidade (Para itens por quantidade ou ajuste) */}
        {tipoOperacao !== 'transferir' &&
          (itemAtivo?.tipo_controle === 'quantidade' || tipoOperacao === 'ajuste') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Quantidade ({itemAtivo?.unidade || 'un'}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-slate-900 focus:ring-slate-900"
                />
              </div>

              {tipoOperacao === 'ajuste' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Sentido do Ajuste <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={tipoAjuste}
                    onChange={(e) => setTipoAjuste(e.target.value as 'entrada' | 'saida')}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="entrada">Acrescentar ao saldo (+)</option>
                    <option value="saida">Subtrair do saldo (-)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Motivo</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value as MotivoMovimentoEstoque)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    {tipoOperacao === 'entrada' ? (
                      <>
                        <option value="compra">Compra de Fornecedor</option>
                        <option value="devolucao">Devolução de Produção / Retalho</option>
                        <option value="outro">Outro</option>
                      </>
                    ) : (
                      <>
                        <option value="producao">Consumo em Produção</option>
                        <option value="perda">Perda / Descarte / Sucata</option>
                        <option value="outro">Outro</option>
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

        {/* Destino em Projeto / Componente (para saída ou reserva) */}
        {(tipoOperacao === 'saida' || tipoOperacao === 'reserva') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Projeto / O.S. de Destino (Opcional)
              </label>
              <select
                value={projetoId}
                onChange={(e) => {
                  setProjetoId(e.target.value);
                  setComponenteId('');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="">Nenhum projeto selecionado</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.descricao}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Peça / Componente (Opcional)
              </label>
              <select
                value={componenteId}
                disabled={!projetoId}
                onChange={(e) => setComponenteId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 disabled:opacity-50"
              >
                <option value="">Selecione a peça...</option>
                {componentesDoProjeto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo ? `${c.codigo} - ` : ''}
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Transferência de Localização */}
        {tipoOperacao === 'transferir' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Nova Localização Física no Almoxarifado <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={novaLocalizacao}
              onChange={(e) => setNovaLocalizacao(e.target.value)}
              placeholder="Ex: Prateleira C-04 / Gaveteiro 02"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            />
          </div>
        )}

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">Observações / Justificativa</label>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Nota fiscal, número do lote ou motivo da baixa"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
          />
        </div>

        {/* Rodapé e Botões */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoading ? 'Processando...' : 'Confirmar Operação'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
