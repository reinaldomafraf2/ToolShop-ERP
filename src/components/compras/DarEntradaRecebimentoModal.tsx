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
import { getQuantidadePendenteItem, getQuantidadeRecebidaItem } from '../../utils/materialStatus';
import {
  PackagePlus,
  AlertTriangle,
  Layers,
  MapPin,
  Scale,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  Search,
  Tag,
  Copy,
  FileText,
  Calendar,
} from 'lucide-react';

interface DarEntradaRecebimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemCompra: ItemCompraComDetalhes | null;
  itensEstoque: ItemEstoqueComDetalhes[];
  onSuccess: (mensagem: string) => void;
}

interface PecaFisicaInput {
  formato: string;
  comprimento: string;
  largura: string;
  espessura: string;
  diametro: string;
  pesoKg: string;
  loteCertificado: string;
}

function extractReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Erro desconhecido.');
  try {
    if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
      const parsed = JSON.parse(raw.trim());
      if (parsed.error) return String(parsed.error);
    }
  } catch {
    // ignore
  }
  return raw;
}

function extractCodigoComercial(item: ItemCompraComDetalhes): string {
  if (item.componente?.codigo?.trim()) {
    return item.componente.codigo.trim().toUpperCase();
  }
  const descClean = (item.descricao || '').replace(/^Item comercial:\s*/i, '').trim();
  const tokenMatch = descClean.match(/^([A-Z0-9][A-Z0-9\-_/.]{2,20})\b/i);
  if (tokenMatch) {
    return tokenMatch[1].toUpperCase();
  }
  return `${item.tipo === 'materia_prima' ? 'MP' : 'IC'}-${descClean
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 14) || 'ITEM'}`;
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

  // Modo: vincular item existente ou cadastrar novo
  const [modoItem, setModoItem] = useState<'existente' | 'novo'>('existente');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [confirmarCriacaoNovoItem, setConfirmarCriacaoNovoItem] = useState(false);

  // Dados do novo item
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<CategoriaItemEstoque>('materia_prima');
  const [novaUnidade, setNovaUnidade] = useState<UnidadeMedidaEstoque>('un');
  const [novaEspecificacao, setNovaEspecificacao] = useState('');
  const [novoTipoControle, setNovoTipoControle] = useState<TipoControleEstoque>('quantidade');

  // Dados do recebimento
  const [quantidade, setQuantidade] = useState('1');
  const [dataRecebimento, setDataRecebimento] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [notaFiscal, setNotaFiscal] = useState('');
  const [localizacao, setLocalizacao] = useState('Almoxarifado');
  const [destinarDiretoProjeto, setDestinarDiretoProjeto] = useState(true);
  const [custoUnitario, setCustoUnitario] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Dados físicos por peça (quando tipo_controle === 'unidade_fisica')
  const [materialFisico, setMaterialFisico] = useState('');
  const [loteGlobal, setLoteGlobal] = useState('');
  const [pecasFisicas, setPecasFisicas] = useState<PecaFisicaInput[]>([]);
  const [etiquetasPreview, setEtiquetasPreview] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicialização ao abrir o modal
  useEffect(() => {
    if (isOpen && itemCompra) {
      setErro(null);
      setConfirmarCriacaoNovoItem(false);
      setSearchItemTerm('');

      const pendente = getQuantidadePendenteItem(itemCompra);
      const qtdInicial = pendente > 0 ? pendente : itemCompra.quantidade || 1;
      setQuantidade(String(qtdInicial));
      setDataRecebimento(new Date().toISOString().split('T')[0]);
      setNotaFiscal(itemCompra.nota_fiscal || '');
      setObservacoes(itemCompra.observacoes || '');

      const codSugerido = extractCodigoComercial(itemCompra);
      const normDesc = (itemCompra.descricao || '')
        .replace(/^(Matéria-prima:|Item comercial:)\s*/i, '')
        .toLowerCase()
        .trim();

      // Localiza item no estoque: ID vinculado -> código exato -> código extraído -> descrição
      const match =
        itensEstoque.find((i) => i.id === itemCompra.item_estoque_id) ||
        itensEstoque.find(
          (i) =>
            i.codigo.trim().toUpperCase() === codSugerido ||
            (itemCompra.componente?.codigo &&
              i.codigo.trim().toUpperCase() === itemCompra.componente.codigo.trim().toUpperCase())
        ) ||
        itensEstoque.find(
          (i) =>
            normDesc &&
            (i.descricao.toLowerCase().includes(normDesc) ||
              normDesc.includes(i.descricao.toLowerCase()))
        );

      if (match) {
        setModoItem('existente');
        setSelectedItemId(match.id);
        setLocalizacao(match.localizacao_padrao || 'Almoxarifado');
      } else {
        setModoItem(itemCompra.tipo === 'item_comercial' ? 'novo' : itensEstoque.length > 0 ? 'existente' : 'novo');
        setSelectedItemId(itensEstoque[0]?.id || '');
        setLocalizacao('Almoxarifado');
      }

      setNovoCodigo(codSugerido);
      setNovaDescricao(
        (itemCompra.descricao || '').replace(/^(Matéria-prima:|Item comercial:)\s*/i, '').trim() ||
          itemCompra.descricao ||
          ''
      );
      setNovaCategoria(itemCompra.tipo === 'materia_prima' ? 'materia_prima' : 'item_comercial');
      setNovaUnidade(itemCompra.unidade || 'un');
      setNovaEspecificacao(itemCompra.especificacao || '');
      setNovoTipoControle(itemCompra.tipo === 'materia_prima' ? 'unidade_fisica' : 'quantidade');

      // Custo unitário
      if (itemCompra.valor_real && itemCompra.quantidade > 0) {
        setCustoUnitario((itemCompra.valor_real / itemCompra.quantidade).toFixed(2));
      } else if (itemCompra.valor_estimado && itemCompra.quantidade > 0) {
        setCustoUnitario((itemCompra.valor_estimado / itemCompra.quantidade).toFixed(2));
      } else {
        setCustoUnitario('');
      }

      // Dimensões padrão da peça física a partir da especificação do item/componente
      const specBase = itemCompra.especificacao || itemCompra.componente?.dimensoes || '';
      setMaterialFisico(itemCompra.componente?.material || itemCompra.especificacao || 'Aço');
      const dimsMatch = specBase.match(
        /(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/
      );
      const formatoPadrao = (itemCompra.componente?.formato || 'BLOCO').toUpperCase();
      let cPadrao = '';
      let lPadrao = '';
      let ePadrao = '';
      let pPadrao = itemCompra.peso_kg ? String(itemCompra.peso_kg) : '';

      if (dimsMatch) {
        cPadrao = dimsMatch[1].replace(',', '.');
        lPadrao = dimsMatch[2].replace(',', '.');
        ePadrao = dimsMatch[3].replace(',', '.');
        if (!pPadrao) {
          const calc = calcularPesoBloco(formatoPadrao, `${cPadrao} X ${lPadrao} X ${ePadrao}`);
          if (calc) pPadrao = calc.peso.toFixed(2);
        }
      }

      const qtdPecas = Math.max(1, Math.round(qtdInicial));
      const loteInit = itemCompra.nota_fiscal ? `NF ${itemCompra.nota_fiscal}` : '';
      setLoteGlobal(loteInit);
      setPecasFisicas(
        Array.from({ length: qtdPecas }, () => ({
          formato: formatoPadrao,
          comprimento: cPadrao,
          largura: lPadrao,
          espessura: ePadrao,
          diametro: '',
          pesoKg: pPadrao,
          loteCertificado: loteInit,
        }))
      );

      setDestinarDiretoProjeto(Boolean(itemCompra.projeto_id && itemCompra.componente_id));
    }
  }, [isOpen, itemCompra, itensEstoque]);

  const itemAtivo = itensEstoque.find((i) => i.id === selectedItemId);
  const isControleFisico =
    modoItem === 'existente'
      ? itemAtivo?.tipo_controle === 'unidade_fisica'
      : novoTipoControle === 'unidade_fisica';

  // Ajusta lista de peças físicas conforme a quantidade digitada
  useEffect(() => {
    if (!isOpen || !isControleFisico) return;
    const qtdNum = Number(quantidade);
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) return;
    const count = Math.max(1, Math.min(50, Math.round(qtdNum)));

    setPecasFisicas((prev) => {
      if (prev.length === count) return prev;
      const template: PecaFisicaInput = prev[0] || {
        formato: 'BLOCO',
        comprimento: '',
        largura: '',
        espessura: '',
        diametro: '',
        pesoKg: '',
        loteCertificado: loteGlobal,
      };
      if (prev.length < count) {
        const extras = Array.from({ length: count - prev.length }, () => ({ ...template }));
        return [...prev, ...extras];
      }
      return prev.slice(0, count);
    });
  }, [quantidade, isControleFisico, isOpen, loteGlobal]);

  // Atualiza pré-visualização das etiquetas sequenciais
  useEffect(() => {
    if (!isOpen || !isControleFisico || !itemCompra) {
      setEtiquetasPreview([]);
      return;
    }
    const count = Math.max(1, pecasFisicas.length);
    estoqueService
      .gerarProximasEtiquetas('PE', count, itemCompra.empresa_id)
      .then(setEtiquetasPreview)
      .catch(() => setEtiquetasPreview([]));
  }, [isOpen, isControleFisico, pecasFisicas.length, itemCompra]);

  if (!isOpen || !itemCompra) return null;

  const qtdTotal = Number(itemCompra.quantidade) || 0;
  const qtdRecebidaAntes = getQuantidadeRecebidaItem(itemCompra);
  const qtdPendenteAtual = getQuantidadePendenteItem(itemCompra);
  const qtdDigitada = Number(quantidade) || 0;
  const seraRecebimentoParcial = qtdDigitada > 0 && qtdDigitada < qtdPendenteAtual - 0.0001;

  const itensFiltrados = itensEstoque.filter((i) => {
    if (!searchItemTerm.trim()) return true;
    const t = searchItemTerm.toLowerCase();
    return (
      i.codigo.toLowerCase().includes(t) ||
      i.descricao.toLowerCase().includes(t) ||
      (i.especificacao || '').toLowerCase().includes(t)
    );
  });

  const handleUpdatePeca = (idx: number, field: keyof PecaFisicaInput, value: string) => {
    setPecasFisicas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleReplicarPrimeiraPeca = () => {
    if (pecasFisicas.length <= 1) return;
    const base = pecasFisicas[0];
    setPecasFisicas((prev) => prev.map(() => ({ ...base })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const qtdNum = Number(quantidade);
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) {
      setErro('Informe uma quantidade recebida válida maior que zero.');
      return;
    }
    if (qtdNum > qtdPendenteAtual + 0.0001) {
      setErro(
        `A quantidade recebida (${qtdNum}) não pode ultrapassar a quantidade pendente (${qtdPendenteAtual}).`
      );
      return;
    }

    if (!dataRecebimento) {
      setErro('Informe a data do recebimento.');
      return;
    }

    if (modoItem === 'existente' && !selectedItemId) {
      setErro('Selecione o item de estoque correspondente ou escolha criar um novo item.');
      return;
    }

    if (modoItem === 'novo') {
      if (!novoCodigo.trim() || !novaDescricao.trim()) {
        setErro('Informe o código e a descrição do novo item de estoque.');
        return;
      }
      if (!confirmarCriacaoNovoItem) {
        setErro('Confirme a criação do novo item de estoque antes de prosseguir.');
        return;
      }
    }

    if (isControleFisico) {
      for (let i = 0; i < pecasFisicas.length; i++) {
        const p = pecasFisicas[i];
        const c = Number(p.comprimento);
        if (isNaN(c) || c <= 0) {
          setErro(`Peça #${i + 1}: informe o comprimento em milímetros.`);
          return;
        }
        if (p.formato === 'BARRA_REDONDA') {
          const d = Number(p.diametro);
          if (isNaN(d) || d <= 0) {
            setErro(`Peça #${i + 1}: informe o diâmetro da barra em milímetros.`);
            return;
          }
        } else {
          const l = Number(p.largura);
          const ep = Number(p.espessura);
          if (isNaN(l) || l <= 0 || isNaN(ep) || ep <= 0) {
            setErro(`Peça #${i + 1}: informe largura e espessura em milímetros.`);
            return;
          }
        }
      }
    }

    setIsLoading(true);
    try {
      const custoNum =
        canViewCustos && custoUnitario.trim()
          ? Number(custoUnitario.replace(',', '.'))
          : undefined;

      const res = await estoqueService.receberItemCompraAtomico(
        {
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
          quantidadeRecebida: qtdNum,
          dataRecebimento,
          notaFiscal: notaFiscal.trim() || undefined,
          localizacao: localizacao.trim() || 'Almoxarifado',
          custo_unitario: custoNum !== undefined && !isNaN(custoNum) ? custoNum : undefined,
          destinarDiretoAoProjeto:
            destinarDiretoProjeto && Boolean(itemCompra.projeto_id && itemCompra.componente_id),
          pecasFisicas: isControleFisico
            ? pecasFisicas.map((p) => ({
                material: materialFisico.trim() || itemAtivo?.especificacao || 'Aço',
                formato: p.formato || 'BLOCO',
                comprimento_mm: Number(p.comprimento) || 0,
                largura_mm: Number(p.largura) || 0,
                espessura_mm: Number(p.espessura) || 0,
                diametro_mm: p.diametro ? Number(p.diametro) : undefined,
                peso_kg: p.pesoKg ? Number(p.pesoKg) : undefined,
                lote_ou_certificado: (p.loteCertificado || loteGlobal).trim() || undefined,
              }))
            : undefined,
          usuarioId: user?.id || 'admin',
          usuarioNome: user?.nome || 'Operador',
          observacoes: observacoes.trim() || undefined,
        },
        itemCompra.empresa_id
      );

      const etiquetasTxt =
        res.unidadesCriadas.length > 0
          ? ` Etiqueta(s): ${res.unidadesCriadas.map((u) => u.etiqueta).join(', ')}.`
          : '';
      const reservaTxt =
        res.reservasCriadas.length > 0 ? ' Material reservado para o projeto de origem.' : '';
      const parcialTxt =
        res.itemCompraAtualizado.status !== 'recebido'
          ? ` Recebimento parcial (${res.itemCompraAtualizado.quantidade_recebida} de ${qtdTotal} ${itemCompra.unidade}).`
          : ' Item concluído e liberado para produção.';

      onSuccess(`Recebimento registrado no estoque!${parcialTxt}${etiquetasTxt}${reservaTxt}`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao receber item de compra:', err);
      setErro(extractReadableError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receber Item de Compra & Entrada no Estoque"
      subtitle="Entrada no estoque, reserva ao projeto e atualização da compra em transação única"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {/* Resumo do Pedido */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
              <PackagePlus className="h-4 w-4 text-blue-700" />
              {itemCompra.descricao}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
              <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-900">
                Pedido: {qtdTotal} {itemCompra.unidade}
              </span>
              {qtdRecebidaAntes > 0 && (
                <span className="bg-amber-100 px-2 py-0.5 rounded border border-amber-300 text-amber-900">
                  Já recebido: {qtdRecebidaAntes}
                </span>
              )}
              <span className="bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">
                Pendente: {qtdPendenteAtual} {itemCompra.unidade}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            {itemCompra.projeto && (
              <div>
                <span className="text-blue-700 font-semibold">Projeto / Peça: </span>
                <span className="font-medium text-slate-800">
                  {itemCompra.projeto.codigo} · {itemCompra.componente?.nome || 'Peça'}
                </span>
              </div>
            )}
            {itemCompra.numero_pedido && (
              <div>
                <span className="text-blue-700 font-semibold">Nº Pedido: </span>
                <span className="font-mono font-bold text-slate-800">{itemCompra.numero_pedido}</span>
              </div>
            )}
            {itemCompra.especificacao && (
              <div className="sm:col-span-2">
                <span className="text-blue-700 font-semibold">Especificação: </span>
                <span className="font-mono text-slate-800">{itemCompra.especificacao}</span>
              </div>
            )}
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-bold block">Falha na transação (nada foi gravado):</span>
              <span>{erro}</span>
            </div>
          </div>
        )}

        {/* Dados Principais do Recebimento */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Qtd. Recebida *
            </label>
            <input
              type="number"
              min="0.01"
              max={qtdPendenteAtual}
              step="any"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>Data Recebimento *</span>
            </label>
            <input
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3 text-slate-400" />
              <span>Nota Fiscal (NF-e)</span>
            </label>
            <input
              type="text"
              value={notaFiscal}
              onChange={(e) => setNotaFiscal(e.target.value)}
              placeholder="Ex: NF 14592"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-400" />
              <span>Localização *</span>
            </label>
            <input
              type="text"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Almoxarifado"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {seraRecebimentoParcial && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Recebimento parcial:</strong> o item permanecerá em <strong>Comprado</strong> mostrando{' '}
              <em>
                &ldquo;Recebido {qtdRecebidaAntes + qtdDigitada} de {qtdTotal}&rdquo;
              </em>{' '}
              com saldo pendente de {(qtdPendenteAtual - qtdDigitada).toFixed(2).replace(/\.00$/, '')}{' '}
              {itemCompra.unidade}.
            </span>
          </div>
        )}

        {/* Destino no Estoque */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Item no Cadastro de Estoque *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setModoItem('existente');
                setConfirmarCriacaoNovoItem(false);
              }}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                modoItem === 'existente'
                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Item Existente no Estoque</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModoItem('novo')}
              className={`rounded-xl border p-2.5 text-left font-medium transition-all ${
                modoItem === 'novo'
                  ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                <span>Cadastrar Novo Item no Estoque</span>
              </div>
            </button>
          </div>
        </div>

        {/* Painel Modo Existente */}
        {modoItem === 'existente' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar item por código ou descrição..."
                value={searchItemTerm}
                onChange={(e) => setSearchItemTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  const it = itensEstoque.find((i) => i.id === e.target.value);
                  if (it?.localizacao_padrao) setLocalizacao(it.localizacao_padrao);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {itensFiltrados.length === 0 && (
                  <option value="">Nenhum item encontrado — mude para "Cadastrar Novo Item"</option>
                )}
                {itensFiltrados.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.codigo}] {i.descricao} · Saldo: {i.saldo} {i.unidade} (
                    {i.tipo_controle === 'unidade_fisica' ? 'Peça Física' : 'Quantidade'})
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
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
                  Unidade
                </label>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value as UnidadeMedidaEstoque)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="un">un</option>
                  <option value="pç">pç</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Controle
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

            <label className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-white p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmarCriacaoNovoItem}
                onChange={(e) => setConfirmarCriacaoNovoItem(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-[11px] font-semibold text-emerald-950">
                Confirmo a criação do novo Item de Estoque{' '}
                <strong className="font-mono">{novoCodigo.trim().toUpperCase() || '—'}</strong>{' '}
                no almoxarifado juntamente com esta entrada.
              </span>
            </label>
          </div>
        )}

        {/* Custo Unitário (Somente Gerente e Admin) & Observações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 font-mono text-xs font-bold text-emerald-800 focus:outline-none"
              />
            </div>
          )}

          <div className={canViewCustos ? '' : 'sm:col-span-2'}>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações do Recebimento
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações da conferência..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Peças Físicas Recebidas (uma UnidadeEstoque por peça) */}
        {isControleFisico && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Scale className="h-4 w-4 text-indigo-600" />
                <span>
                  Peças Físicas Recebidas ({pecasFisicas.length} unidade{pecasFisicas.length > 1 ? 's' : ''})
                </span>
              </div>
              {pecasFisicas.length > 1 && (
                <button
                  type="button"
                  onClick={handleReplicarPrimeiraPeca}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar medidas da Peça #1 para todas</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Material
                </label>
                <input
                  type="text"
                  value={materialFisico}
                  onChange={(e) => setMaterialFisico(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Lote / Corrida / Certificado (padrão)
                </label>
                <input
                  type="text"
                  value={loteGlobal}
                  onChange={(e) => setLoteGlobal(e.target.value)}
                  placeholder="Ex: Lote A-984 / Certif. 2026"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pecasFisicas.map((peca, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800">
                      Peça #{idx + 1}
                    </span>
                    {etiquetasPreview[idx] && (
                      <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-800">
                        <Tag className="h-2.5 w-2.5" />
                        <span>Etiqueta: {etiquetasPreview[idx]}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Formato</label>
                      <select
                        value={peca.formato}
                        onChange={(e) => handleUpdatePeca(idx, 'formato', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
                      >
                        <option value="BLOCO">BLOCO</option>
                        <option value="BARRA_REDONDA">REDONDO</option>
                        <option value="BARRA_CHATA">BARRA CHATA</option>
                        <option value="CHAPA">CHAPA</option>
                        <option value="TUBO">TUBO</option>
                        <option value="OUTRO">OUTRO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Comp. (mm) *</label>
                      <input
                        type="number"
                        step="any"
                        value={peca.comprimento}
                        onChange={(e) => handleUpdatePeca(idx, 'comprimento', e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                      />
                    </div>
                    {peca.formato === 'BARRA_REDONDA' ? (
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Diâmetro (mm) *</label>
                        <input
                          type="number"
                          step="any"
                          value={peca.diametro}
                          onChange={(e) => handleUpdatePeca(idx, 'diametro', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Larg. (mm) *</label>
                          <input
                            type="number"
                            step="any"
                            value={peca.largura}
                            onChange={(e) => handleUpdatePeca(idx, 'largura', e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Espess. (mm) *</label>
                          <input
                            type="number"
                            step="any"
                            value={peca.espessura}
                            onChange={(e) => handleUpdatePeca(idx, 'espessura', e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Peso (kg)</label>
                      <input
                        type="number"
                        step="any"
                        value={peca.pesoKg}
                        onChange={(e) => handleUpdatePeca(idx, 'pesoKg', e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destinar ao projeto de origem */}
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
                Destinar ao projeto de origem (Entrada + Reserva automática)
              </span>
              <span className="block text-[11px] text-indigo-800/80 mt-0.5">
                Reserva o material recebido para o componente{' '}
                <strong>{itemCompra.componente?.nome || 'de origem'}</strong> do projeto{' '}
                <strong>{itemCompra.projeto?.codigo}</strong> na mesma transação.
              </span>
            </label>
          </div>
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
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isLoading ? 'Processando Transação...' : 'Confirmar Recebimento'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
