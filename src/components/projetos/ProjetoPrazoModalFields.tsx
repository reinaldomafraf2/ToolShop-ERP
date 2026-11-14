import React, { useEffect, useState } from 'react';
import { ConfiguracoesSistema, PrazoOrigem } from '../../types';
import { recalcularCamposPrazoProjeto } from '../../services/prazoProjetoService';
import {
  calcularDiasUteisRestantes,
  formatHorasCompactas,
  formatLocalDateTimeInput,
  formatPrazoHorasComContagem,
  normalizarConfigCalendario,
  parseDateTimeToMs,
  parseLocalDateTimeInput,
  snapFimExpediente,
} from '../../utils/calendarioTrabalho';
import { formatDateTimeBR } from '../../utils/formatters';
import { AlertTriangle, Info } from 'lucide-react';

interface ProjetoPrazoModalFieldsProps {
  isEditing?: boolean;
  initialDataInicio?: string;
  dataInicio: string; // ISO string ou '' quando produção ainda não foi iniciada
  dataEntrega: string; // ISO string
  prazoHoras: string; // string numeric input
  prazoOrigem: PrazoOrigem;
  configuracoes?: ConfiguracoesSistema | null;
  errorPrazo?: string;
  onChange: (next: {
    data_inicio: string;
    data_entrega: string;
    prazo: string;
    prazo_horas: string;
    prazo_origem: PrazoOrigem;
  }) => void;
}

export const ProjetoPrazoModalFields: React.FC<ProjetoPrazoModalFieldsProps> = ({
  isEditing = false,
  initialDataInicio = '',
  dataInicio,
  dataEntrega,
  prazoHoras,
  prazoOrigem,
  configuracoes,
  errorPrazo,
  onChange,
}) => {
  const cal = normalizarConfigCalendario(configuracoes);
  const [editPrazoHorasTouched, setEditPrazoHorasTouched] = useState(false);
  const [baseContagemEdit, setBaseContagemEdit] = useState<'inicio' | 'agora'>(() =>
    initialDataInicio ? 'inicio' : 'agora'
  );
  const [agoraRefIso, setAgoraRefIso] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    setEditPrazoHorasTouched(false);
    setBaseContagemEdit(initialDataInicio ? 'inicio' : 'agora');
    setAgoraRefIso(new Date().toISOString());
  }, [isEditing, initialDataInicio]);

  const applyNewInicio = (newInicioIso: string) => {
    const recalc = recalcularCamposPrazoProjeto(
      {
        data_inicio: newInicioIso || undefined,
        referencia_inicio: newInicioIso || agoraRefIso,
        data_entrega: dataEntrega || undefined,
        prazo_horas: prazoHoras ? Number(prazoHoras.replace(',', '.')) : undefined,
        prazo_origem: prazoOrigem,
      },
      configuracoes
    );

    onChange({
      data_inicio: recalc.data_inicio || '',
      data_entrega: recalc.data_entrega,
      prazo: recalc.prazo,
      prazo_horas: String(recalc.prazo_horas),
      prazo_origem: recalc.prazo_origem,
    });
  };

  const handleDataInicioChange = (localVal: string) => {
    if (!localVal) {
      applyNewInicio('');
      return;
    }
    const newInicio = parseLocalDateTimeInput(localVal);
    if (!newInicio) return;
    applyNewInicio(newInicio);
  };

  const handleDataEntregaChange = (localVal: string) => {
    if (!localVal) {
      onChange({
        data_inicio: dataInicio,
        data_entrega: '',
        prazo: '',
        prazo_horas: '',
        prazo_origem: 'data',
      });
      return;
    }

    // Se o usuário escolheu data pela primeira vez (dataEntrega estava vazia) e o horário veio 00:00 do picker,
    // ajusta para o fim do expediente padrão.
    let targetIso = parseLocalDateTimeInput(localVal);
    if (!dataEntrega && localVal.endsWith('T00:00')) {
      const snapped = snapFimExpediente(localVal.slice(0, 10), cal);
      if (snapped) targetIso = snapped;
    }

    const recalc = recalcularCamposPrazoProjeto(
      {
        data_inicio: dataInicio || undefined,
        referencia_inicio: agoraRefIso,
        data_entrega: targetIso,
        prazo_origem: 'data',
      },
      configuracoes
    );

    onChange({
      data_inicio: recalc.data_inicio || '',
      data_entrega: recalc.data_entrega,
      prazo: recalc.prazo,
      prazo_horas: String(recalc.prazo_horas),
      prazo_origem: 'data',
    });
  };

  const handleDataEntregaDateOnly = (dateYYYYMMDD: string) => {
    if (!dateYYYYMMDD) return;
    const snapped = snapFimExpediente(dateYYYYMMDD, cal);
    if (!snapped) return;
    const recalc = recalcularCamposPrazoProjeto(
      {
        data_inicio: dataInicio || undefined,
        referencia_inicio: agoraRefIso,
        data_entrega: snapped,
        prazo_origem: 'data',
      },
      configuracoes
    );
    onChange({
      data_inicio: recalc.data_inicio || '',
      data_entrega: recalc.data_entrega,
      prazo: recalc.prazo,
      prazo_horas: String(recalc.prazo_horas),
      prazo_origem: 'data',
    });
  };

  const handlePrazoHorasChange = (raw: string) => {
    const freshNowIso = editPrazoHorasTouched ? agoraRefIso : new Date().toISOString();
    if (!editPrazoHorasTouched) {
      setAgoraRefIso(freshNowIso);
      if (isEditing) {
        setEditPrazoHorasTouched(true);
      }
    }
    const baseEfetiva =
      baseContagemEdit === 'inicio' && (initialDataInicio || dataInicio) ? 'inicio' : 'agora';

    if (!raw.trim()) {
      onChange({
        data_inicio: dataInicio,
        data_entrega: dataEntrega,
        prazo: dataEntrega ? dataEntrega.slice(0, 10) : '',
        prazo_horas: '',
        prazo_origem: 'horas',
      });
      return;
    }

    const num = Number(raw.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      onChange({
        data_inicio: dataInicio,
        data_entrega: dataEntrega,
        prazo: dataEntrega ? dataEntrega.slice(0, 10) : '',
        prazo_horas: raw,
        prazo_origem: 'horas',
      });
      return;
    }

    const inicioProjetoRef = initialDataInicio || dataInicio;
    const effectiveDataInicio = isEditing
      ? baseEfetiva === 'inicio' && inicioProjetoRef
        ? inicioProjetoRef
        : freshNowIso
      : dataInicio || undefined;

    const recalc = recalcularCamposPrazoProjeto(
      {
        data_inicio: effectiveDataInicio,
        referencia_inicio: freshNowIso,
        prazo_horas: num,
        prazo_origem: 'horas',
      },
      configuracoes
    );

    onChange({
      data_inicio: recalc.data_inicio || '',
      data_entrega: recalc.data_entrega,
      prazo: recalc.prazo,
      prazo_horas: raw,
      prazo_origem: 'horas',
    });
  };

  const handleSelecionarBaseEdit = (base: 'inicio' | 'agora') => {
    setBaseContagemEdit(base);
    setEditPrazoHorasTouched(true);
    const inicioProjetoRef = initialDataInicio || dataInicio;
    const num = Number(prazoHoras.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return;

    const effectiveDataInicio =
      base === 'inicio' && inicioProjetoRef ? inicioProjetoRef : agoraRefIso;
    const recalc = recalcularCamposPrazoProjeto(
      {
        data_inicio: effectiveDataInicio,
        referencia_inicio: agoraRefIso,
        prazo_horas: num,
        prazo_origem: 'horas',
      },
      configuracoes
    );

    onChange({
      data_inicio: recalc.data_inicio || '',
      data_entrega: recalc.data_entrega,
      prazo: recalc.prazo,
      prazo_horas: prazoHoras,
      prazo_origem: 'horas',
    });
  };

  const inicioProjetoRef = initialDataInicio || '';
  const parsedHorasNum = prazoHoras.trim() ? Number(prazoHoras.replace(',', '.')) : NaN;
  const showPerguntaBase =
    isEditing &&
    editPrazoHorasTouched &&
    Number.isFinite(parsedHorasNum) &&
    parsedHorasNum >= 0;

  const previewEntregaDeInicio =
    showPerguntaBase && inicioProjetoRef
      ? recalcularCamposPrazoProjeto(
          {
            data_inicio: inicioProjetoRef,
            prazo_horas: parsedHorasNum,
            prazo_origem: 'horas',
          },
          configuracoes
        ).data_entrega
      : '';

  const previewEntregaDeAgora = showPerguntaBase
    ? recalcularCamposPrazoProjeto(
        {
          data_inicio: agoraRefIso,
          prazo_horas: parsedHorasNum,
          prazo_origem: 'horas',
        },
        configuracoes
      ).data_entrega
    : '';

  const inicioMs = dataInicio ? parseDateTimeToMs(dataInicio) : parseDateTimeToMs(agoraRefIso);
  const entregaMs = dataEntrega ? parseDateTimeToMs(dataEntrega) : NaN;
  const hasValidRange = Number.isFinite(inicioMs) && Number.isFinite(entregaMs) && entregaMs >= inicioMs;
  const entregaNoPassado = Number.isFinite(entregaMs) && entregaMs < Date.now() - 60_000;
  const diasUteisJanela = hasValidRange ? calcularDiasUteisRestantes(inicioMs, entregaMs, cal) : 0;
  const horasUteisJanela = diasUteisJanela * cal.horasExpedienteDia;
  const capacidadePadrao1Maq = horasUteisJanela * (cal.disponibilidade_percentual_padrao / 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800">
          Janela de Prazo ({cal.contagem_prazo === 'expediente' ? 'Horas de expediente' : 'Horas corridas 24h'})
        </span>
        <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-600">
          Origem: {prazoOrigem === 'horas' ? 'Prazo em horas' : 'Data de entrega'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-700">
              Início da Produção
            </label>
            <button
              type="button"
              onClick={() => applyNewInicio(new Date().toISOString())}
              className="text-[10px] font-semibold text-blue-700 hover:underline"
              title="Definir o início da produção como o momento atual"
            >
              Usar agora
            </button>
          </div>
          <input
            type="datetime-local"
            value={formatLocalDateTimeInput(dataInicio)}
            onChange={(e) => handleDataInicioChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
          {!dataInicio && (
            <span className="mt-1 block text-[10px] text-amber-700">
              Não iniciado (use &quot;Iniciar produção&quot; após salvar ou clique em &quot;Usar agora&quot;)
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-700">
              Entrega ao Cliente <span className="text-rose-500">*</span>
            </label>
            {dataEntrega && (
              <button
                type="button"
                onClick={() => handleDataEntregaDateOnly(formatLocalDateTimeInput(dataEntrega).slice(0, 10))}
                className="text-[10px] font-semibold text-blue-700 hover:underline"
                title={`Ajustar horário para fim do expediente (${cal.expedienteFim})`}
              >
                Fim exp. ({cal.expedienteFim})
              </button>
            )}
          </div>
          <input
            type="datetime-local"
            value={formatLocalDateTimeInput(dataEntrega)}
            onChange={(e) => handleDataEntregaChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700">
            Prazo ({cal.contagem_prazo === 'expediente' ? 'horas de expediente' : 'horas corridas 24h'})
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Ex: 100"
            value={prazoHoras}
            onChange={(e) => handlePrazoHorasChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Pergunta obrigatória ao editar prazo_horas de um projeto existente */}
      {showPerguntaBase && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2">
          <div className="text-[11px] font-bold text-blue-950">
            Contar {formatPrazoHorasComContagem(parsedHorasNum, cal.contagem_prazo)} a partir de:
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-[11px] cursor-pointer transition-colors ${
                !inicioProjetoRef
                  ? 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'
                  : baseContagemEdit === 'inicio'
                  ? 'border-blue-600 bg-white text-slate-900 ring-1 ring-blue-500'
                  : 'border-blue-200 bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="base_contagem_prazo_horas"
                checked={baseContagemEdit === 'inicio' && Boolean(inicioProjetoRef)}
                disabled={!inicioProjetoRef}
                onChange={() => handleSelecionarBaseEdit('inicio')}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="block font-semibold">
                  Início do projeto{' '}
                  {inicioProjetoRef ? `(${formatDateTimeBR(inicioProjetoRef)})` : '(não iniciado)'}
                </span>
                {previewEntregaDeInicio ? (
                  <span className="block font-mono text-[10px] text-blue-800">
                    Entrega resultante: <strong>{formatDateTimeBR(previewEntregaDeInicio)}</strong>
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-400">
                    Defina o início ou selecione &quot;Agora&quot;
                  </span>
                )}
              </div>
            </label>

            <label
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-[11px] cursor-pointer transition-colors ${
                baseContagemEdit === 'agora'
                  ? 'border-blue-600 bg-white text-slate-900 ring-1 ring-blue-500'
                  : 'border-blue-200 bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="base_contagem_prazo_horas"
                checked={baseContagemEdit === 'agora'}
                onChange={() => handleSelecionarBaseEdit('agora')}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="block font-semibold">
                  Agora ({formatDateTimeBR(agoraRefIso)})
                </span>
                <span className="block font-mono text-[10px] text-blue-800">
                  Entrega resultante: <strong>{formatDateTimeBR(previewEntregaDeAgora)}</strong>
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {hasValidRange && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            Entrega prevista: <strong className="text-slate-900">{formatDateTimeBR(dataEntrega)}</strong> ·{' '}
            Contém <strong className="font-mono text-slate-900">{diasUteisJanela.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} dias úteis</strong>{' '}
            (<strong className="font-mono text-slate-900">{formatHorasCompactas(horasUteisJanela)}</strong> de expediente ·{' '}
            ~<strong className="font-mono text-slate-900">{formatHorasCompactas(capacidadePadrao1Maq)}</strong> úteis c/ {cal.disponibilidade_percentual_padrao}% disp. por máquina 1x).
            {!dataInicio && (
              <> Cálculo estimado a partir de agora até que a produção seja iniciada.</>
            )}
            {cal.contagem_prazo === 'corridas' && (
              <> Como a contagem está em <strong>horas corridas (24h/dia)</strong>, fins de semana e horas fora do expediente também contam no prazo.</>
            )}
          </span>
        </div>
      )}

      {entregaNoPassado && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span>
            <strong>Atenção:</strong> a entrega calculada (<strong>{formatDateTimeBR(dataEntrega)}</strong>) está no passado em relação a agora
            {dataInicio ? ` (porque o Início está em ${formatDateTimeBR(dataInicio)})` : ''}. Clique em <strong>&quot;Usar agora&quot;</strong> ou ajuste a data de entrega.
          </span>
        </div>
      )}

      {errorPrazo && <p className="text-xs text-rose-600">{errorPrazo}</p>}
    </div>
  );
};
