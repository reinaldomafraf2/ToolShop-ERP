import React, { useState } from 'react';
import { UnidadeEstoqueComDetalhes } from '../../types';
import { estoqueService } from '../../services/estoqueService';
import { Modal } from '../common/Modal';
import {
  Search,
  Box,
  Compass,
  ArrowRight,
  Printer,
  BookmarkPlus,
  AlertCircle,
  Sparkles,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

interface ProcurarPecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUnidadeParaSaida?: (unidade: UnidadeEstoqueComDetalhes) => void;
  onSelectUnidadeParaReserva?: (unidade: UnidadeEstoqueComDetalhes) => void;
  onImprimirEtiqueta?: (unidade: UnidadeEstoqueComDetalhes) => void;
}

export const ProcurarPecaModal: React.FC<ProcurarPecaModalProps> = ({
  isOpen,
  onClose,
  onSelectUnidadeParaSaida,
  onSelectUnidadeParaReserva,
  onImprimirEtiqueta,
}) => {
  const [comprimentoMin, setComprimentoMin] = useState<string>('');
  const [larguraMin, setLarguraMin] = useState<string>('');
  const [espessuraMin, setEspessuraMin] = useState<string>('');
  const [materialFiltro, setMaterialFiltro] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<
    {
      unidade: UnidadeEstoqueComDetalhes;
      volumeNecessarioMm3: number;
      volumePecaMm3: number;
      sobraVolumeMm3: number;
      sobraPercentual: number;
    }[]
  >([]);

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const c = Number(comprimentoMin);
    const l = Number(larguraMin);
    const ep = Number(espessuraMin);

    if (isNaN(c) || c <= 0 || isNaN(l) || l <= 0 || isNaN(ep) || ep <= 0) {
      setErro('Informe comprimento, largura e espessura mínimos válidos em milímetros.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await estoqueService.procurarPecasQueAtendem({
        comprimentoMin: c,
        larguraMin: l,
        espessuraMin: ep,
        material: materialFiltro.trim() || undefined,
      });
      setResultados(res);
      setBuscou(true);
    } catch (err: any) {
      console.error('Erro ao procurar peça:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimpar = () => {
    setComprimentoMin('');
    setLarguraMin('');
    setEspessuraMin('');
    setMaterialFiltro('');
    setResultados([]);
    setBuscou(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Procurar Peça ou Sobra que Atenda"
      subtitle="Localize retalhos e blocos em qualquer orientação 3D com a menor sobra de material"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Formulário de Busca */}
        <form onSubmit={handleBuscar} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-blue-600" />
              <span>Medidas Mínimas do Bruto Desejado (mm)</span>
            </span>
            <span className="text-[11px] text-slate-500">
              O algoritmo avalia rotações 3D (X, Y, Z) automaticamente
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Comprimento Mín. (mm)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={comprimentoMin}
                onChange={(e) => setComprimentoMin(e.target.value)}
                placeholder="Ex: 250"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Largura Mín. (mm)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={larguraMin}
                onChange={(e) => setLarguraMin(e.target.value)}
                placeholder="Ex: 180"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Espessura Mín. (mm)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={espessuraMin}
                onChange={(e) => setEspessuraMin(e.target.value)}
                placeholder="Ex: 45"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Material (Opcional)</label>
              <input
                type="text"
                value={materialFiltro}
                onChange={(e) => setMaterialFiltro(e.target.value)}
                placeholder="Ex: P20, 1045, D2"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {buscou && (
              <button
                type="button"
                onClick={handleLimpar}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Limpar
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Pesquisando...' : 'Buscar Peças Disponíveis'}</span>
            </button>
          </div>
        </form>

        {/* Resultados */}
        {buscou && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Peças Compatíveis Encontradas ({resultados.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Ordenado por menor sobra de usinagem
              </span>
            </div>

            {resultados.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                <Box className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-slate-800">
                  Nenhuma peça física ou sobra disponível atende a estas medidas no estoque atual.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Experimente reduzir os requisitos de sobremetal ou consultar novos pedidos de compra.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {resultados.map((res, index) => {
                  const u = res.unidade;
                  const isMelhorAproveitamento = index === 0;

                  return (
                    <div
                      key={u.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        isMelhorAproveitamento
                          ? 'border-emerald-300 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Identificação e Medidas */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                              {u.etiqueta}
                            </span>
                            <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                              {u.origem === 'sobra' ? 'RETALHO' : 'PEÇA'}
                            </span>
                            {isMelhorAproveitamento && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                                <Sparkles className="h-3 w-3" />
                                <span>Menor Desperdício</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-semibold text-slate-900">
                            {u.material || u.item?.especificacao} · {u.formato}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
                            <span>
                              Dimensões:{' '}
                              <strong>
                                {u.diametro_mm
                                  ? `Ø ${u.diametro_mm} × ${u.comprimento_mm} mm`
                                  : `${u.comprimento_mm} × ${u.largura_mm} × ${u.espessura_mm} mm`}
                              </strong>
                            </span>
                            {u.peso_kg && <span>· {u.peso_kg.toFixed(2)} kg</span>}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>Local: <strong>{u.localizacao || 'Almoxarifado'}</strong></span>
                            {u.origem_projeto_codigo && (
                              <span>· Origem: O.S. {u.origem_projeto_codigo}</span>
                            )}
                          </div>
                        </div>

                        {/* Indicadores de Sobra e Ações */}
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          <div className="text-right">
                            <span className="block text-[11px] font-bold text-slate-700">
                              Sobra Estimada: +{res.sobraPercentual}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Excedente: {(res.sobraVolumeMm3 / 1000).toFixed(1)} cm³
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            {onImprimirEtiqueta && (
                              <button
                                type="button"
                                onClick={() => onImprimirEtiqueta(u)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                title="Imprimir etiqueta desta peça"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onSelectUnidadeParaReserva && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectUnidadeParaReserva(u);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                              >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                                <span>Reservar</span>
                              </button>
                            )}
                            {onSelectUnidadeParaSaida && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectUnidadeParaSaida(u);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 shadow-2xs"
                              >
                                <span>Consumir</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
