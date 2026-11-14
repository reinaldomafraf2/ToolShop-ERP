import React, { useEffect, useState } from 'react';
import {
  ConfiguracoesSistema,
  ContagemPrazo,
  FeriadoCalendario,
} from '../../types';
import { toolShopService } from '../../services/toolShopService';
import { normalizarConfigCalendario } from '../../utils/calendarioTrabalho';
import { formatDateBR } from '../../utils/formatters';
import { Calendar, Clock, Plus, Save, Trash2 } from 'lucide-react';

interface CalendarioTrabalhoCardProps {
  config: ConfiguracoesSistema | null;
  canEdit: boolean;
  usuarioNome: string;
  onUpdated: (updated: ConfiguracoesSistema) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
  onRefresh?: () => void;
}

const DIAS_SEMANA_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export const CalendarioTrabalhoCard: React.FC<CalendarioTrabalhoCardProps> = ({
  config,
  canEdit,
  usuarioNome,
  onUpdated,
  onFeedback,
  onRefresh,
}) => {
  const [contagemPrazo, setContagemPrazo] = useState<ContagemPrazo>('corridas');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [expedienteInicio, setExpedienteInicio] = useState<string>('08:00');
  const [expedienteFim, setExpedienteFim] = useState<string>('17:00');
  const [almocoHoras, setAlmocoHoras] = useState<string>('1');
  const [feriados, setFeriados] = useState<FeriadoCalendario[]>([]);
  const [novoFeriadoData, setNovoFeriadoData] = useState<string>('');
  const [novoFeriadoNome, setNovoFeriadoNome] = useState<string>('');
  const [atencaoPercentual, setAtencaoPercentual] = useState<string>('15');
  const [disponibilidadePadrao, setDisponibilidadePadrao] = useState<string>('85');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const norm = normalizarConfigCalendario(config);
    setContagemPrazo(norm.contagem_prazo);
    setDiasSemana(norm.diasSemana.length > 0 ? norm.diasSemana : [1, 2, 3, 4, 5]);
    setExpedienteInicio(norm.expedienteInicio);
    setExpedienteFim(norm.expedienteFim);
    setAlmocoHoras(String(norm.almocoHoras));
    setFeriados(norm.feriados);
    setAtencaoPercentual(String(norm.atencao_percentual));
    setDisponibilidadePadrao(String(norm.disponibilidade_percentual_padrao));
  }, [config]);

  const previewNorm = normalizarConfigCalendario({
    contagem_prazo: contagemPrazo,
    expediente_dias_semana: diasSemana,
    expediente_inicio: expedienteInicio,
    expediente_fim: expedienteFim,
    expediente_almoco_horas: Number(almocoHoras.replace(',', '.')),
    feriados,
    atencao_percentual: Number(atencaoPercentual.replace(',', '.')),
    disponibilidade_percentual_padrao: Number(disponibilidadePadrao.replace(',', '.')),
  });

  const handleToggleDia = (dia: number) => {
    if (!canEdit) return;
    setDiasSemana((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b)
    );
  };

  const handleAddFeriado = () => {
    if (!canEdit) return;
    if (!novoFeriadoData || !novoFeriadoNome.trim()) {
      onFeedback('error', 'Informe a data e o nome do feriado antes de adicionar.');
      return;
    }
    const cleanData = novoFeriadoData.slice(0, 10);
    if (feriados.some((f) => f.data === cleanData)) {
      onFeedback('error', `Já existe um feriado cadastrado em ${formatDateBR(cleanData)}.`);
      return;
    }
    const updated = [...feriados, { data: cleanData, nome: novoFeriadoNome.trim() }].sort((a, b) =>
      a.data.localeCompare(b.data)
    );
    setFeriados(updated);
    setNovoFeriadoData('');
    setNovoFeriadoNome('');
  };

  const handleRemoveFeriado = (data: string) => {
    if (!canEdit) return;
    setFeriados((prev) => prev.filter((f) => f.data !== data));
  };

  const handleSaveCalendario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSaving) return;

    if (diasSemana.length === 0) {
      onFeedback('error', 'Selecione pelo menos um dia útil da semana para o expediente.');
      return;
    }

    const almocoNum = Number(almocoHoras.replace(',', '.'));
    if (!Number.isFinite(almocoNum) || almocoNum < 0 || almocoNum > 12) {
      onFeedback('error', 'O intervalo de almoço deve ser entre 0 e 12 horas.');
      return;
    }

    const atencaoNum = Number(atencaoPercentual.replace(',', '.'));
    if (!Number.isFinite(atencaoNum) || atencaoNum < 0 || atencaoNum > 100) {
      onFeedback('error', 'O percentual de atenção deve estar entre 0% e 100%.');
      return;
    }

    const dispNum = Number(disponibilidadePadrao.replace(',', '.'));
    if (!Number.isFinite(dispNum) || dispNum <= 0 || dispNum > 100) {
      onFeedback('error', 'A disponibilidade padrão dos recursos deve estar entre 1% e 100%.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await toolShopService.updateConfiguracoes(
        {
          contagem_prazo: contagemPrazo,
          expediente_dias_semana: diasSemana,
          expediente_inicio: expedienteInicio,
          expediente_fim: expedienteFim,
          expediente_almoco_horas: almocoNum,
          feriados,
          atencao_percentual: atencaoNum,
          disponibilidade_percentual_padrao: dispNum,
        },
        usuarioNome
      );
      onUpdated(updated);
      onFeedback('success', 'Calendário de trabalho e parâmetros de prazo salvos com sucesso!');
      onRefresh?.();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Erro ao salvar calendário de trabalho.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveCalendario}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Calendar className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Calendário de trabalho</h2>
          </div>
          <p className="text-xs text-slate-500 pl-10">
            Define a contagem do prazo dos projetos, expediente produtivo, feriados e disponibilidade padrão dos centros de custo.
          </p>
        </div>

        <span className="self-start rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700">
          Expediente líquido: {previewNorm.horasExpedienteDia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h/dia útil
        </span>
      </div>

      {/* Contagem de prazo */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-800">
          Modo de contagem do prazo do projeto (contagem_prazo)
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {(
            [
              {
                value: 'corridas',
                label: 'Horas corridas (padrão)',
                desc: 'Conta 24 horas por dia, todos os dias da semana entre início e entrega.',
              },
              {
                value: 'expediente',
                label: 'Horas de expediente',
                desc: 'Conta apenas as horas úteis dentro do expediente e fora dos feriados.',
              },
            ] as Array<{ value: ContagemPrazo; label: string; desc: string }>
          ).map((opt) => {
            const active = contagemPrazo === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!canEdit || isSaving}
                onClick={() => setContagemPrazo(opt.value)}
                className={`rounded-xl border p-3 text-left transition-all disabled:opacity-60 ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block text-xs font-bold">{opt.label}</span>
                <span
                  className={`block text-[11px] mt-0.5 ${
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dias úteis e horários do expediente */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Dias úteis da semana
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA_OPTIONS.map((dia) => {
              const checked = diasSemana.includes(dia.value);
              return (
                <button
                  key={dia.value}
                  type="button"
                  disabled={!canEdit || isSaving}
                  onClick={() => handleToggleDia(dia.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    checked
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {dia.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            Utilizado tanto para contagem de prazo em expediente quanto para calcular dias úteis disponíveis até a entrega.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Início expediente
            </label>
            <input
              type="time"
              disabled={!canEdit || isSaving}
              value={expedienteInicio}
              onChange={(e) => setExpedienteInicio(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Fim expediente
            </label>
            <input
              type="time"
              disabled={!canEdit || isSaving}
              value={expedienteFim}
              onChange={(e) => setExpedienteFim(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Almoço (horas)
            </label>
            <input
              type="number"
              min="0"
              max="12"
              step="0.25"
              disabled={!canEdit || isSaving}
              value={almocoHoras}
              onChange={(e) => setAlmocoHoras(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Percentuais de Atenção e Disponibilidade padrão */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Margem de Atenção (%) — padrão 15%
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Sinaliza "Atenção" quando restar menos que este % do prazo e "Apertado" quando a ocupação passar de (100 - X)%.
          </p>
          <div className="mt-2 relative w-32">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              disabled={!canEdit || isSaving}
              value={atencaoPercentual}
              onChange={(e) => setAtencaoPercentual(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 pr-7 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
            />
            <span className="absolute right-2.5 top-1.5 text-xs text-slate-400">%</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800">
            Disponibilidade padrão dos recursos (%) — padrão 85%
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Considera preparação de máquina, troca de ferramenta e imprevistos quando o centro de custo não define um valor próprio.
          </p>
          <div className="mt-2 relative w-32">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              disabled={!canEdit || isSaving}
              value={disponibilidadePadrao}
              onChange={(e) => setDisponibilidadePadrao(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 pr-7 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
            />
            <span className="absolute right-2.5 top-1.5 text-xs text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* Lista de feriados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800">Feriados e dias não úteis</h3>
            <p className="text-[11px] text-slate-500">
              Datas cadastradas aqui não contam como dias úteis na capacidade nem no prazo em expediente.
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            {feriados.length} cadastrado(s)
          </span>
        </div>

        {canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              disabled={isSaving}
              value={novoFeriadoData}
              onChange={(e) => setNovoFeriadoData(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <input
              type="text"
              disabled={isSaving}
              placeholder="Nome do feriado (ex.: Dia do Trabalhador)"
              value={novoFeriadoNome}
              onChange={(e) => setNovoFeriadoNome(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleAddFeriado}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar feriado</span>
            </button>
          </div>
        )}

        {feriados.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {feriados.map((f) => (
              <div
                key={f.data}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
              >
                <Clock className="h-3 w-3 text-slate-400" />
                <span className="font-mono font-bold text-slate-800">{formatDateBR(f.data)}</span>
                <span className="text-slate-700">{f.nome}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFeriado(f.data)}
                    className="text-slate-400 hover:text-rose-600"
                    title="Remover feriado"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé com botão Salvar */}
      <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] text-slate-500">
          Padrão: Seg–Sex, 08:00–17:00, 1h almoço, Atenção 15%, Disponibilidade 85%
        </span>
        {canEdit ? (
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Calendário de Trabalho'}</span>
          </button>
        ) : (
          <span className="text-[11px] text-amber-700 italic">
            Apenas Gerente e Administrador podem alterar
          </span>
        )}
      </div>
    </form>
  );
};
