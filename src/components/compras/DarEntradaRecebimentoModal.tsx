import React, { useState, useEffect } from 'react';
import {
  ItemCompraComDetalhes,
  ItemEstoqueComDetalhes,
  CategoriaItemEstoque,
  TipoControleEstoque,
  UnidadeMedidaEstoque,
} from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import { calcularPesoBloco } from '../../utils/weightCalculator';
import { formatCurrencyBRL } from '../../utils/formatters';
import {
  PackagePlus,
  AlertTriangle,
  Layers,
  MapPin,
  Scale,
  FolderKanban,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  Search,
} from 'lucide-react';

interface DarEntradaRecebimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemCompra: ItemCompraComDetalhes | null;
  itensEstoque: ItemEstoqueComDetalhes[];
  onSuccess: (mensagem: string) => void;
}

export const DarEntradaRecebimentoModal: React.FC<DarEntradaRecebimentoModalProps> = ({
  isOpen,
  onClose,
  itemCompra,
  itensEstoque,
  onSuccess,
}) => {
  const { user, perfil, can } = useAuth();
  const canViewCustos = can('ver', 'custos') || perfil === 'gerente' || perfil === 'admin';

  // Modo: escolher item existente ou cadastrar novo
  const [modoItem, setModoItem] = useState<'existente' | 'novo'>('existente');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [searchItemTerm, setSearchItemTerm] = useState('');

  // Dados do novo item
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<CategoriaItemEstoque>('materia_prima');
  const [novaUnidade, setNovaUnidade] = useState<UnidadeMedidaEstoque>('un');
  const [novaEspecificacao, setNovaEspecificacao] = useState('');
  const [novoTipoControle, setNovoTipoControle] = useState<TipoControleEstoque>('quantidade');

  // Quantidade e Localização
  const [quantidade, setQuantidade] = useState('1');
  const [localizacao, setLocalizacao] = useState('Almoxarifado');
  const [destinarDiretoProjeto, setDestinarDiretoProjeto] = useState(true);

  // Custo unitário (visível apenas para gerente e admin)
  const [custoUnitario, setCustoUnitario] = useState('');

  // Dados para peça física (quando tipo_controle === 'unidade_fisica')
  const [materialFisico, setMaterialFisico] = useState('');
  const [formatoFisico, setFormatoFisico] = useState('BLOCO');
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [espessura, setEspessura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [loteCertificado, setLoteCertificado] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicialização quando o modal abre
  useEffect(() => {
    if (isOpen && itemCompra) {
      setErro(null);
      setQuantidade(String(itemCompra.quantidade || 1));
      setObservacoes(itemCompra.observacoes || '');

      // Tenta sugerir item de estoque existente correspondente
      const normDesc = (itemCompra.descricao || '').toLowerCase().trim();
      const match = itensEstoque.find(
        (i) =>
          i.id === itemCompra.item_estoque_id ||
          i.codigo.toLowerCase() === normDesc ||
          i.descricao.toLowerCase().includes(normDesc)
      );

      if (match) {
        setModoItem('existente');
        setSelectedItemId(match.id);
        setLocalizacao(match.localizacao_padrao || 'Almoxarifado');
      } else {
        // Sugere criar novo com base no ItemCompra
        setModoItem(itensEstoque.length > 0 ? 'existente' : 'novo');
        if (itensEstoque.length > 0) {
          setSelectedItemId(itensEstoque[0].id);
        }
      }

      // Preenche formulário de novo item
      const codSugerido = (itemCompra.componente?.codigo || itemCompra.tipo === 'materia_prima' ? 'MP-' : 'IC-') +
        (itemCompra.descricao || 'ITEM').replace(/\s+/g, '-').toUpperCase().slice(0, 15);
      setNovoCodigo(codSugerido);
      setNovaDescricao(itemCompra.descricao || '');
      setNovaCategoria(itemCompra.tipo === 'materia_prima' ? 'materia_prima' : 'item_comercial');
      setNovaUnidade(itemCompra.unidade || 'un');
      setNovaEspecificacao(itemCompra.especificacao || '');
      setNovoTipoControle(itemCompra.tipo === 'materia_prima' ? 'unidade_fisica' : 'quantidade');

      // Custo unitário a partir do valor real de compra
      if (itemCompra.valor_real && itemCompra.quantidade > 0) {
        const cUnit = itemCompra.valor_real / itemCompra.quantidade;
        setCustoUnitario(cUnit.toFixed(2));
      } else if (itemCompra.valor_estimado && itemCompra.quantidade > 0) {
        const cUnit = itemCompra.valor_estimado / itemCompra.quantidade;
        setCustoUnitario(cUnit.toFixed(2));
      } else {
        setCustoUnitario('');
      }

      // Extração de dimensões para peças físicas
      setMaterialFisico(itemCompra.especificacao || itemCompra.descricao || 'Aço');
      const dimsMatch = (itemCompra.especificacao || '').match(
        /(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/
      );
      if (dimsMatch) {
        setFormatoFisico('BLOCO');
        setComprimento(dimsMatch[1]);
        setLargura(dimsMatch[2]);
        setEspessura(dimsMatch[3]);
        if (itemCompra.peso_kg) {
          setPesoKg(String(itemCompra.peso_kg));
        } else {
          const calc = calcularPesoBloco('BLOCO', `${dimsMatch[1]} X ${dimsMatch[2]} X ${dimsMatch[3]}`);
          if (calc) setPesoKg(calc.peso.toFixed(2));
        }
      } else {
        setFormatoFisico('BLOCO');
        setComprimento('');
        setLargura('');
        setEspessura('');
        setDiametro('');
        setPesoKg(itemCompra.peso_kg ? String(itemCompra.peso_kg) : '');
      }

      setLoteCertificado(itemCompra.nota_fiscal ? `NF ${itemCompra.nota_fiscal}` : '');
      setDestinarDiretoProjeto(Boolean(itemCompra.projeto_id && itemCompra.componente_id));
    }
  }, [isOpen, itemCompra, itensEstoque]);

  if (!isOpen || !itemCompra) return null;

  // Item ativo no modo existente
  const itemAtivo = itensEstoque.find((i) => i.id === selectedItemId);
  const isControleFisico =
    modoItem === 'existente'
      ? itemAtivo?.tipo_controle === 'unidade_fisica'
      : novoTipoControle === 'unidade_fisica';

  // Itens filtrados para busca
  const itensFiltrados = itensEstoque.filter((i) => {
    if (!searchItemTerm.trim()) return true;
    const t = searchItemTerm.toLowerCase();
    return i.codigo.toLowerCase().includes(t) || i.descricao.toLowerCase().includes(t);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const qtdNum = Number(quantidade);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      setErro('Informe uma quantidade válida maior que zero.');
      return;
    }

    if (modoItem === 'existente' && !selectedItemId) {
      setErro('Selecione o item de estoque correspondente.');
      return;
    }

    if (modoItem === 'novo') {
      if (!novoCodigo.trim() || !novaDescricao.trim()) {
        setErro('Informe o código e a descrição do novo item de estoque.');
        return;
      }
    }

    // Se for físico, valida dimensões
    if (isControleFisico) {
      const c = Number(comprimento);
      if (isNaN(c) || c <= 0) {
        setErro('Informe o comprimento da peça em milímetros.');
        return;
      }
      if (formatoFisico === 'BARRA_REDONDA') {
        const d = Number(diametro);
        if (isNaN(d) || d <= 0) {
          setErro('Informe o diâmetro da barra em milímetros.');
          return;
        }
      } else {
        const l = Number(largura);
        const ep = Number(espessura);
        if (isNaN(l) || l <= 0 || isNaN(ep) || ep <= 0) {
          setErro('Informe largura e espessura da peça em milímetros.');
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      const custoNum =
        canViewCustos && custoUnitario.trim()
          ? Number(custoUnitario.replace(',', '.'))
          : undefined;

      const res = await estoqueService.darEntradaPorRecebimento({
        itemCompraId: itemCompra.id,
        itemId: modoItem === 'existente' ? selectedItemId : undefined,
        novoItem:
          modoItem === 'novo'
            ? {
                codigo: novoCodigo.trim().toUpperCase(),
                descricao: novaDescricao.trim(),
                categoria: novaCategoria,
                unidade: novaUnidade,
                especificacao: novaEspecificacao.trim(),
                tipo_controle: novoTipoControle,
                localizacao_padrao: localizacao.trim() || 'Almoxarifado',
              }
            : undefined,
        quantidade: qtdNum,
        localizacao: localizacao.trim() || 'Almoxarifado',
        custo_unitario: isNaN(Number(custoNum)) ? undefined : custoNum,
        destinarDiretoAoProjeto: destinarDiretoProjeto && Boolean(itemCompra.projeto_id && itemCompra.componente_id),
        dadosUnidadeFisica: isControleFisico
          ? {
              material: materialFisico.trim() || itemAtivo?.especificacao || 'Aço',
              formato: formatoFisico,
              comprimento_mm: Number(comprimento) || 0,
              largura_mm: Number(largura) || 0,
              espessura_mm: Number(espessura) || 0,
              diametro_mm: diametro ? Number(diametro) : undefined,
              peso_kg: pesoKg ? Number(pesoKg) : undefined,
              lote_ou_certificado: loteCertificado.trim() || undefined,
            }
          : undefined,
        usuarioId: user?.id || 'admin',
        usuarioNome: user?.nome || 'Operador',
        observacoes: observacoes.trim() || undefined,
      });

      let msg = `Entrada de ${qtdNum} ${itemCompra.unidade} confirmada com sucesso!`;
      if (res.novaUnidade) {
        msg += ` Etiqueta física gerada: ${res.novaUnidade.etiqueta}.`;
      }
      if (res.reserva) {
        msg += ` Material reservado diretamente para a peça do projeto.`;
      }

      onSuccess(msg);
      onClose();
    } catch (err: any) {
      console.error('Erro ao dar entrada no estoque:', err);
      setErro(err.message || 'Erro ao registrar entrada no estoque.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dar Entrada no Estoque (Recebimento)"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {/* Resumo da Compra */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
              <PackagePlus className="h-4 w-4 text-blue-700" />
              Item Comprado Recebido
            </span>
            <span className="font-mono text-[11px] font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
              Qtd: {itemCompra.quantidade} {itemCompra.unidade}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-blue-700 font-semibold">Descrição: </span>
              <span className="font-medium text-slate-800">{itemCompra.descricao}</span>
            </div>
            {itemCompra.projeto && (
              <div>
                <span className="text-blue-700 font-semibold">Projeto / Peça: </span>
                <span className="font-medium text-slate-800">
                  {itemCompra.projeto.codigo} · {itemCompra.componente?.nome || 'Peça'}
                </span>
              </div>
            )}
            {itemCompra.especificacao && (
              <div className="sm:col-span-2">
                <span className="text-blue-700 font-semibold">Especificação: </span>
                <span className="font-mono text-slate-800">{itemCompra.especificacao}</span>
              </div>
            )}
            {itemCompra.fornecedor && (
              <div>
                <span className="text-blue-700 font-semibold">Fornecedor: </span>
                <span className="text-slate-800">{itemCompra.fornecedor.nome}</span>
              </div>
            )}
            {itemCompra.nota_fiscal && (
              <div>
                <span className="text-blue-700 font-semibold">Nota Fiscal: </span>
                <span className="font-mono text-slate-800">{itemCompra.nota_fiscal}</span>
              </div>
            )}
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Escolha: Item existente ou novo cadastro */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Destino no Cadastro de Estoque *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModoItem('existente')}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                modoItem === 'existente'
                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Vincular a Item Existente</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModoItem('novo')}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                modoItem === 'novo'
                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                <span>Criar Novo Item de Estoque</span>
              </div>
            </button>
          </div>
        </div>

        {/* Painel Modo Existente */}
        {modoItem === 'existente' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar itens por código ou descrição..."
                value={searchItemTerm}
                onChange={(e) => setSearchItemTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Item do Almoxarifado ({itensFiltrados.length} opções):
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  const it = itensEstoque.find((i) => i.id === e.target.value);
                  if (it?.localizacao_padrao) setLocalizacao(it.localizacao_padrao);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {itensFiltrados.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.codigo}] {i.descricao} · Saldo: {i.saldo} {i.unidade} ({i.tipo_controle === 'unidade_fisica' ? 'Peça Física' : 'Quantidade'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Painel Modo Novo Item */}
        {modoItem === 'novo' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Código Único *
                </label>
                <input
                  type="text"
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900 focus:border-emerald-600 focus:outline-none"
                  placeholder="Ex: MP-1045-BLOCO"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Descrição do Item *
                </label>
                <input
                  type="text"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  placeholder="Ex: Aço SAE 1045 Forjado / Bloco Bruto"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Categoria
                </label>
                <select
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value as CategoriaItemEstoque)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="materia_prima">Matéria-Prima</option>
                  <option value="item_comercial">Item Comercial</option>
                  <option value="consumivel">Consumível</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Unidade de Medida
                </label>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value as UnidadeMedidaEstoque)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="un">un (Unidades)</option>
                  <option value="pç">pç (Peças)</option>
                  <option value="kg">kg (Quilos)</option>
                  <option value="m">m (Metros)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Controle de Estoque
                </label>
                <select
                  value={novoTipoControle}
                  onChange={(e) => setNovoTipoControle(e.target.value as TipoControleEstoque)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-900"
                >
                  <option value="unidade_fisica">Unidade Física (Peça rastreada)</option>
                  <option value="quantidade">Por Quantidade (Saldo contínuo)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quantidade, Localização e Custo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantidade de Entrada *
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
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-400" />
              <span>Localização Física *</span>
            </label>
            <input
              type="text"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: Prateleira A-02, Pátio 1"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          {canViewCustos && (
            <div>
              <label className="block text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-blue-700" />
                <span>Custo Unitário (R$)</span>
              </label>
              <input
                type="text"
                value={custoUnitario}
                onChange={(e) => setCustoUnitario(e.target.value)}
                placeholder="Ex: 850,00"
                className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 font-mono text-xs font-bold text-emerald-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Detalhes da Peça Física (Se tipo_controle === unidade_fisica) */}
        {isControleFisico && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Scale className="h-4 w-4 text-indigo-600" />
              <span>Dimensões e Rastreabilidade da Peça Física (Unidade de Estoque)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Comprimento (mm) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={comprimento}
                  onChange={(e) => setComprimento(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold text-slate-900"
                  placeholder="Ex: 605"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Largura (mm) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={largura}
                  onChange={(e) => setLargura(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold text-slate-900"
                  placeholder="Ex: 689"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Espessura (mm) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={espessura}
                  onChange={(e) => setEspessura(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold text-slate-900"
                  placeholder="Ex: 65"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Peso Estimado (kg)
                </label>
                <input
                  type="number"
                  step="any"
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold text-slate-900"
                  placeholder="Ex: 213.2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Lote / Corrida / Certificado
                </label>
                <input
                  type="text"
                  value={loteCertificado}
                  onChange={(e) => setLoteCertificado(e.target.value)}
                  placeholder="Ex: Lote A-984 / Certif. 2026-X"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Material
                </label>
                <input
                  type="text"
                  value={materialFisico}
                  onChange={(e) => setMaterialFisico(e.target.value)}
                  placeholder="Ex: Aço Toolox 44, P20"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Destinar Direto ao Projeto (Reserva Imediata) */}
        {itemCompra.projeto_id && itemCompra.componente_id && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 flex items-start gap-3">
            <input
              type="checkbox"
              id="destinarDiretoProjeto"
              checked={destinarDiretoProjeto}
              onChange={(e) => setDestinarDiretoProjeto(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="destinarDiretoProjeto" className="cursor-pointer select-none">
              <span className="block text-xs font-bold text-indigo-950">
                Destinar direto ao projeto (Criar entrada e reservar automaticamente)
              </span>
              <span className="block text-[11px] text-indigo-800/80 mt-0.5">
                Cria o movimento de entrada no estoque e já efetua a reserva da peça/quantidade para o componente{' '}
                <strong>{itemCompra.componente?.nome || 'de origem'}</strong> do projeto{' '}
                <strong>{itemCompra.projeto?.codigo}</strong>.
              </span>
            </label>
          </div>
        )}

        {/* Botões do Rodapé */}
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
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isLoading ? 'Registrando Entrada...' : 'Confirmar Entrada no Estoque'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
