import React, { useState, useEffect } from 'react';
import {
  ItemEstoque,
  CategoriaItemEstoque,
  TipoControleEstoque,
  UnidadeMedidaEstoque,
} from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import { Package, AlertTriangle, Layers, MapPin, Hash, FileText } from 'lucide-react';

interface ItemEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemParaEditar?: ItemEstoque | null;
  onSuccess: () => void;
}

export const ItemEstoqueModal: React.FC<ItemEstoqueModalProps> = ({
  isOpen,
  onClose,
  itemParaEditar,
  onSuccess,
}) => {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaItemEstoque>('materia_prima');
  const [unidade, setUnidade] = useState<UnidadeMedidaEstoque>('un');
  const [especificacao, setEspecificacao] = useState('');
  const [tipoControle, setTipoControle] = useState<TipoControleEstoque>('quantidade');
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>('');
  const [localizacaoPadrao, setLocalizacaoPadrao] = useState('');
  const [saldoInicial, setSaldoInicial] = useState<string>('0');
  const [ativo, setAtivo] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (itemParaEditar) {
      setCodigo(itemParaEditar.codigo);
      setDescricao(itemParaEditar.descricao);
      setCategoria(itemParaEditar.categoria);
      setUnidade(itemParaEditar.unidade);
      setEspecificacao(itemParaEditar.especificacao || '');
      setTipoControle(itemParaEditar.tipo_controle);
      setEstoqueMinimo(
        itemParaEditar.estoque_minimo !== undefined && itemParaEditar.estoque_minimo !== null
          ? String(itemParaEditar.estoque_minimo)
          : ''
      );
      setLocalizacaoPadrao(itemParaEditar.localizacao_padrao || '');
      setSaldoInicial(String(itemParaEditar.saldo || 0));
      setAtivo(itemParaEditar.ativo ?? true);
    } else {
      setCodigo('');
      setDescricao('');
      setCategoria('materia_prima');
      setUnidade('un');
      setEspecificacao('');
      setTipoControle('quantidade');
      setEstoqueMinimo('');
      setLocalizacaoPadrao('');
      setSaldoInicial('0');
      setAtivo(true);
    }
    setErro(null);
  }, [itemParaEditar, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const codLimpo = codigo.trim().toUpperCase();
    if (!codLimpo) {
      setErro('Informe o código do item.');
      return;
    }
    if (!descricao.trim()) {
      setErro('Informe a descrição do item.');
      return;
    }

    setIsLoading(true);
    try {
      if (itemParaEditar) {
        await estoqueService.atualizarItem(itemParaEditar.id, {
          codigo: codLimpo,
          descricao: descricao.trim(),
          categoria,
          unidade,
          especificacao: especificacao.trim(),
          tipo_controle: tipoControle,
          estoque_minimo: estoqueMinimo.trim() !== '' ? Number(estoqueMinimo) : undefined,
          localizacao_padrao: localizacaoPadrao.trim() || undefined,
          ativo,
        });
      } else {
        await estoqueService.criarItem({
          codigo: codLimpo,
          descricao: descricao.trim(),
          categoria,
          unidade,
          especificacao: especificacao.trim(),
          tipo_controle: tipoControle,
          estoque_minimo: estoqueMinimo.trim() !== '' ? Number(estoqueMinimo) : undefined,
          localizacao_padrao: localizacaoPadrao.trim() || undefined,
          saldo: Number(saldoInicial) || 0,
          ativo,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar item de estoque.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={itemParaEditar ? 'Editar Item de Estoque' : 'Novo Item de Estoque'}
      subtitle={
        itemParaEditar
          ? `Atualize dados cadastrais do item ${itemParaEditar.codigo}`
          : 'Cadastre matéria-prima, componente comercial ou consumível com controle de saldo'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Código */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Código Único <span className="text-rose-500">*</span>
            </label>
            <div className="mt-1 relative rounded-xl shadow-2xs">
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: MP-ACO-001, PAR-M8-30"
                className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 focus:border-slate-900 focus:ring-slate-900"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Identificador padronizado no almoxarifado
            </span>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Categoria <span className="text-rose-500">*</span>
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaItemEstoque)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            >
              <option value="materia_prima">Matéria-Prima (Aços, Alumínio, Latão, etc.)</option>
              <option value="item_comercial">Item Comercial (Parafusos, Molas, Rolamentos)</option>
              <option value="consumivel">Consumível (Pastilhas, Machos, Óleo, Brocas)</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Descrição do Item <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Bloco de Aço P20 Beneficiado / Parafuso Allen M8x35"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
          />
        </div>

        {/* Especificação Técnica */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Especificação Técnica / Dimensões / Norma
          </label>
          <textarea
            rows={2}
            value={especificacao}
            onChange={(e) => setEspecificacao(e.target.value)}
            placeholder="Ex: DIN 1.2311 / ASTM A681, Dureza 28-32 HRC, retificado 4 faces"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Tipo de Controle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Tipo de Controle <span className="text-rose-500">*</span>
            </label>
            <select
              value={tipoControle}
              onChange={(e) => setTipoControle(e.target.value as TipoControleEstoque)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            >
              <option value="quantidade">Por Quantidade (Saldo Contínuo)</option>
              <option value="unidade_fisica">Unidade Física (Blocos, Barras e Sobras)</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {tipoControle === 'unidade_fisica'
                ? 'Rastreia cada bloco ou barra individualmente com etiqueta'
                : 'Controla saldo numérico global simples'}
            </span>
          </div>

          {/* Unidade de Medida */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Unidade de Medida <span className="text-rose-500">*</span>
            </label>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as UnidadeMedidaEstoque)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            >
              <option value="un">un (Unidades)</option>
              <option value="kg">kg (Quilogramas)</option>
              <option value="m">m (Metros)</option>
              <option value="pç">pç (Peças)</option>
            </select>
          </div>

          {/* Estoque Mínimo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Estoque Mínimo (Alerta)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
              placeholder="Opcional"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Localização Padrão */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Localização Padrão
            </label>
            <input
              type="text"
              value={localizacaoPadrao}
              onChange={(e) => setLocalizacaoPadrao(e.target.value)}
              placeholder="Ex: Prateleira A-02 / Gaveteiro 04 / Pátio Barras"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            />
          </div>

          {/* Saldo Inicial (Apenas na criação) */}
          {!itemParaEditar ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Saldo Físico Inicial
              </label>
              <input
                type="number"
                min="0"
                step="any"
                disabled={tipoControle === 'unidade_fisica'}
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-slate-900 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
              {tipoControle === 'unidade_fisica' && (
                <span className="text-[10px] text-amber-700 mt-0.5 block">
                  Unidades físicas iniciam com 0 e são adicionadas via entrada com medidas.
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-semibold text-slate-700">Item Ativo no Estoque</span>
              </label>
            </div>
          )}
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
            {isLoading ? 'Salvando...' : itemParaEditar ? 'Salvar Alterações' : 'Cadastrar Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
