import React, { useState, useEffect } from 'react';
import {
  ItemEstoqueComDetalhes,
  ProjetoComDetalhes,
} from '../../types';
import { Modal } from '../common/Modal';
import { estoqueService } from '../../services/estoqueService';
import { useAuth } from '../../auth/AuthContext';
import { calcularPesoBloco } from '../../utils/weightCalculator';
import { Scissors, AlertTriangle, Layers, MapPin, Scale } from 'lucide-react';

interface RegistrarSobraModalProps {
  isOpen: boolean;
  onClose: () => void;
  itensDisponiveis: ItemEstoqueComDetalhes[];
  projetos: ProjetoComDetalhes[];
  onSuccess: (mensagem: string) => void;
  defaultProjetoId?: string;
  defaultComponenteId?: string;
  defaultMaterial?: string;
  defaultFormato?: string;
}

export const RegistrarSobraModal: React.FC<RegistrarSobraModalProps> = ({
  isOpen,
  onClose,
  itensDisponiveis,
  projetos,
  onSuccess,
  defaultProjetoId,
  defaultComponenteId,
  defaultMaterial,
  defaultFormato,
}) => {
  const { user } = useAuth();
  const [itemId, setItemId] = useState('');
  const [formato, setFormato] = useState(defaultFormato || 'BLOCO');
  const [material, setMaterial] = useState(defaultMaterial || '');
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [espessura, setEspessura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [peso, setPeso] = useState('');
  const [localizacao, setLocalizacao] = useState('Retalhos / Sobras');
  const [projetoId, setProjetoId] = useState(defaultProjetoId || '');
  const [componenteId, setComponenteId] = useState(defaultComponenteId || '');
  const [observacoes, setObservacoes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtra itens de matéria-prima ou de unidade física preferencialmente
  const itensMateriaPrima = itensDisponiveis.filter(
    (i) => i.categoria === 'materia_prima' || i.tipo_controle === 'unidade_fisica'
  );

  useEffect(() => {
    if (itensMateriaPrima.length > 0) {
      setItemId(itensMateriaPrima[0].id);
      setMaterial(defaultMaterial || itensMateriaPrima[0].especificacao || itensMateriaPrima[0].descricao);
    } else if (itensDisponiveis.length > 0) {
      setItemId(itensDisponiveis[0].id);
      setMaterial(defaultMaterial || itensDisponiveis[0].especificacao || itensDisponiveis[0].descricao);
    }
    setFormato(defaultFormato || 'BLOCO');
    setComprimento('');
    setLargura('');
    setEspessura('');
    setDiametro('');
    setPeso('');
    setLocalizacao('Retalhos / Sobras');
    setProjetoId(defaultProjetoId || '');
    setComponenteId(defaultComponenteId || '');
    setObservacoes('');
    setErro(null);
  }, [isOpen, defaultProjetoId, defaultComponenteId, defaultMaterial, defaultFormato]);

  const itemAtivo = itensDisponiveis.find((i) => i.id === itemId);

  // Atualiza material padrão ao mudar o item
  const handleItemChange = (newId: string) => {
    setItemId(newId);
    const it = itensDisponiveis.find((i) => i.id === newId);
    if (it) {
      setMaterial(it.especificacao || it.descricao);
    }
  };

  // Cálculo automático do peso estimado quando for bloco
  const handleCalcularPeso = () => {
    if (formato === 'BLOCO' && comprimento && largura && espessura) {
      const p = calcularPesoBloco('BLOCO', `${comprimento} X ${largura} X ${espessura}`);
      if (p !== null) {
        setPeso(p.peso.toFixed(2));
      }
    }
  };

  const componentesDoProjeto = React.useMemo(() => {
    if (!projetoId) return [];
    const proj = projetos.find((p) => p.id === projetoId);
    return proj?.componentes || [];
  }, [projetoId, projetos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!itemId) {
      setErro('Selecione o item de estoque correspondente ao material.');
      return;
    }

    const c = Number(comprimento);
    if (isNaN(c) || c <= 0) {
      setErro('Informe o comprimento da sobra em mm.');
      return;
    }

    if (formato === 'BARRA_REDONDA') {
      const d = Number(diametro);
      if (isNaN(d) || d <= 0) {
        setErro('Informe o diâmetro da barra em mm.');
        return;
      }
    } else {
      const l = Number(largura);
      const ep = Number(espessura);
      if (isNaN(l) || l <= 0 || isNaN(ep) || ep <= 0) {
        setErro('Informe largura e espessura da sobra em mm.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await estoqueService.registrarSobra({
        itemId,
        material: material.trim() || itemAtivo?.especificacao || 'Aço',
        formato,
        comprimento_mm: c,
        largura_mm: Number(largura) || 0,
        espessura_mm: Number(espessura) || 0,
        diametro_mm: diametro ? Number(diametro) : undefined,
        peso_kg: peso ? Number(peso) : undefined,
        localizacao: localizacao.trim() || 'Retalhos / Sobras',
        projetoId: projetoId || undefined,
        componenteId: componenteId || undefined,
        observacoes: observacoes.trim() || undefined,
        usuarioId: user?.id || 'admin',
        usuarioNome: user?.nome || 'Operador',
      });

      onSuccess(`Sobra registrada com sucesso sob a etiqueta ${res.unidade.etiqueta}.`);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar sobra de material.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Sobra / Retalho Aproveitável"
      subtitle="Cadastre pedaços, sobras de corte ou retalhos de usinagem com rastreabilidade"
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
          {/* Item Pai de Matéria-Prima */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Tipo de Material / Item Pai <span className="text-rose-500">*</span>
            </label>
            <select
              value={itemId}
              onChange={(e) => handleItemChange(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            >
              {(itensMateriaPrima.length > 0 ? itensMateriaPrima : itensDisponiveis).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.codigo} — {it.descricao}
                </option>
              ))}
            </select>
          </div>

          {/* Formato */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Formato da Peça <span className="text-rose-500">*</span>
            </label>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
            >
              <option value="BLOCO">Bloco Retangular / Placa</option>
              <option value="BARRA_REDONDA">Barra Redonda / Tarugo Cilíndrico</option>
              <option value="BARRA_CHATA">Barra Chata</option>
              <option value="CHAPA">Chapa Plana</option>
              <option value="TUBO">Tubo Mecânico</option>
              <option value="OUTRO">Outro Formato</option>
            </select>
          </div>
        </div>

        {/* Material Descritivo */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Material / Aço <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Ex: Aço P20 Beneficiado / D2 / VND / 1045"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-slate-900"
          />
        </div>

        {/* Dimensões da Sobra */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Dimensões Úteis da Sobra (mm)
            </span>
            {formato === 'BLOCO' && (
              <button
                type="button"
                onClick={handleCalcularPeso}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Scale className="h-3 w-3" />
                <span>Estimar Peso Aço</span>
              </button>
            )}
          </div>

          {formato === 'BARRA_REDONDA' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Diâmetro (Ø mm)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={diametro}
                  onChange={(e) => setDiametro(e.target.value)}
                  placeholder="Ø milímetros"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Comprimento (mm)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
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
                <label className="block text-[11px] font-semibold text-slate-700">Comprimento</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={comprimento}
                  onChange={(e) => setComprimento(e.target.value)}
                  placeholder="C (mm)"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Largura</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={largura}
                  onChange={(e) => setLargura(e.target.value)}
                  placeholder="L (mm)"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">Espessura</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={espessura}
                  onChange={(e) => setEspessura(e.target.value)}
                  placeholder="E (mm)"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Peso Estimado (kg)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ex: 14.5"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Localização na Oficina</label>
              <input
                type="text"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="Ex: Palete Retalhos 01 / Prateleira R-03"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Origem da Sobra (Projeto e Componente) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <span className="text-xs font-bold text-slate-800 block">
            Origem da Peça / Sobra de Corte
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Projeto / Ferramenta</label>
              <select
                value={projetoId}
                onChange={(e) => {
                  setProjetoId(e.target.value);
                  setComponenteId('');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="">Sem vínculo a projeto</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.descricao}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Peça de Origem</label>
              <select
                value={componenteId}
                disabled={!projetoId}
                onChange={(e) => setComponenteId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 disabled:opacity-50"
              >
                <option value="">Selecione o componente...</option>
                {componentesDoProjeto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo ? `${c.codigo} - ` : ''}
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">Observações Adicionais</label>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Sobra do corte da placa superior, faces esquadrejadas"
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
          >
            <Scissors className="h-4 w-4 text-amber-400" />
            <span>{isLoading ? 'Registrando...' : 'Registrar Sobra'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
