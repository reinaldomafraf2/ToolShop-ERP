import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adicionarHorasCalendario,
  contarHorasCalendario,
  formatLocalDateTimeInput,
  getLocalDateKey,
  normalizarConfigCalendario,
  parseDateTimeToMs,
  snapFimExpediente,
  zonedDateTimeToUtcMs,
} from '../src/utils/calendarioTrabalho';
import { formatDateBR, formatDateTimeBR } from '../src/utils/formatters';
import {
  avaliarPrazoProjeto,
  recalcularCamposPrazoProjeto,
  resolverDatasEfetivasProjeto,
} from '../src/services/prazoProjetoService';
import { CentroCusto, ConfiguracoesSistema, Projeto } from '../src/types';

const BASE_CONFIG: Partial<ConfiguracoesSistema> = {
  expediente_dias_semana: [1, 2, 3, 4, 5],
  expediente_inicio: '08:00',
  expediente_fim: '17:00',
  expediente_almoco_horas: 1,
  feriados: [],
  atencao_percentual: 15,
  disponibilidade_percentual_padrao: 85,
};

const CNC_CENTRO: CentroCusto = {
  id: 'cc-cnc-1',
  empresa_id: 'emp-1',
  nome: 'CNC',
  tipo: 'CNC',
  categoria: 'Usinagem',
  origem: 'interno',
  modelo_custo: 'hora',
  valor_unitario: 120,
  custo_hora: 120,
  ativo: true,
  capacidade_paralela: 1,
  disponibilidade_percentual: 85,
};

function makeProjetoTeste(overrides: Partial<Projeto>): Projeto {
  return {
    id: 'prj-teste-1',
    empresa_id: 'emp-1',
    cliente_id: 'cli-1',
    codigo: 'PRJ-TESTE-01',
    descricao: 'Projeto de Teste 100h / 35h',
    prazo: '2026-11-17',
    status: 'Em andamento',
    criado_em: '2026-11-01T10:00:00.000Z',
    horas_consumidas: 0,
    horas_estimadas_total: 35,
    horas_a_executar: 35,
    horas_a_executar_por_cc: { [CNC_CENTRO.id]: 35 },
    ...overrides,
  };
}

test('5a) Contagem corridas: sexta 2026-11-13 08:00 + 100 h = terça 2026-11-17 12:00 (America/Sao_Paulo)', () => {
  const cfg: Partial<ConfiguracoesSistema> = { ...BASE_CONFIG, contagem_prazo: 'corridas' };
  const cal = normalizarConfigCalendario(cfg);

  const inicioMs = zonedDateTimeToUtcMs(2026, 11, 13, 8, 0, 0);
  const esperadoEntregaMs = zonedDateTimeToUtcMs(2026, 11, 17, 12, 0, 0);

  const entregaIso = adicionarHorasCalendario(inicioMs, 100, cal);
  assert.equal(new Date(entregaIso).getTime(), esperadoEntregaMs);
  assert.equal(formatLocalDateTimeInput(entregaIso), '2026-11-17T12:00');
  assert.equal(contarHorasCalendario(inicioMs, entregaIso, cal), 100);
});

test('5b) Contagem expediente: sexta 2026-11-13 08:00 + 100 h = terça 2026-12-01 12:00 (America/Sao_Paulo)', () => {
  const cfg: Partial<ConfiguracoesSistema> = { ...BASE_CONFIG, contagem_prazo: 'expediente' };
  const cal = normalizarConfigCalendario(cfg);

  const inicioMs = zonedDateTimeToUtcMs(2026, 11, 13, 8, 0, 0);
  const esperadoEntregaMs = zonedDateTimeToUtcMs(2026, 12, 1, 12, 0, 0);

  const entregaIso = adicionarHorasCalendario(inicioMs, 100, cal);
  assert.equal(new Date(entregaIso).getTime(), esperadoEntregaMs);
  assert.equal(formatLocalDateTimeInput(entregaIso), '2026-12-01T12:00');
  assert.equal(contarHorasCalendario(inicioMs, entregaIso, cal), 100);
});

test('5c) Corridas com 35 h de carga em 1 máquina (85% disp): capacidade ~17 h, resultado Sem tempo hábil', () => {
  const cfg: Partial<ConfiguracoesSistema> = { ...BASE_CONFIG, contagem_prazo: 'corridas' };
  const inicioMs = zonedDateTimeToUtcMs(2026, 11, 13, 8, 0, 0);
  const inicioIso = new Date(inicioMs).toISOString();

  const campos = recalcularCamposPrazoProjeto(
    {
      data_inicio: inicioIso,
      prazo_horas: 100,
      prazo_origem: 'horas',
    },
    cfg
  );

  assert.equal(formatLocalDateTimeInput(campos.data_entrega), '2026-11-17T12:00');

  const projeto = makeProjetoTeste({
    data_inicio: campos.data_inicio,
    data_entrega: campos.data_entrega,
    prazo: campos.prazo,
    prazo_horas: campos.prazo_horas,
    prazo_origem: 'horas',
  });

  // Avaliando no instante de início (sexta 2026-11-13 08:00 BRT)
  const aval = avaliarPrazoProjeto(projeto, cfg, [CNC_CENTRO], inicioMs, [projeto]);

  assert.equal(aval.statusCalendario, 'no_prazo');
  assert.equal(aval.statusTempoHabil, 'nao');
  assert.equal(aval.diasUteisRestantes, 2.5);
  assert.equal(aval.capacidadesCC.length, 1);
  assert.equal(aval.capacidadesCC[0].capacidadeDisponivelH, 17);
  assert.equal(aval.capacidadesCC[0].cargaAcumuladaH, 35);
  assert.match(aval.seloTempoHabilLabel, /^Não · CNC/);
  assert.match(
    aval.regraSeloTempoHabil,
    /Sem tempo hábil: CNC precisa de 35 h e só tem 17 h de capacidade até a entrega/
  );
});

test('5d) Expediente com 35 h de carga em 1 máquina (85% disp): capacidade ~85 h, resultado Sim', () => {
  const cfg: Partial<ConfiguracoesSistema> = { ...BASE_CONFIG, contagem_prazo: 'expediente' };
  const inicioMs = zonedDateTimeToUtcMs(2026, 11, 13, 8, 0, 0);
  const inicioIso = new Date(inicioMs).toISOString();

  const campos = recalcularCamposPrazoProjeto(
    {
      data_inicio: inicioIso,
      prazo_horas: 100,
      prazo_origem: 'horas',
    },
    cfg
  );

  assert.equal(formatLocalDateTimeInput(campos.data_entrega), '2026-12-01T12:00');

  const projeto = makeProjetoTeste({
    data_inicio: campos.data_inicio,
    data_entrega: campos.data_entrega,
    prazo: campos.prazo,
    prazo_horas: campos.prazo_horas,
    prazo_origem: 'horas',
  });

  const aval = avaliarPrazoProjeto(projeto, cfg, [CNC_CENTRO], inicioMs, [projeto]);

  assert.equal(aval.statusCalendario, 'no_prazo');
  assert.equal(aval.statusTempoHabil, 'sim');
  assert.equal(aval.diasUteisRestantes, 12.5);
  assert.equal(aval.capacidadesCC.length, 1);
  assert.equal(aval.capacidadesCC[0].capacidadeDisponivelH, 85);
  assert.equal(aval.capacidadesCC[0].cargaAcumuladaH, 35);
  assert.equal(aval.seloTempoHabilLabel, 'Sim');
});

test('Fuso horário America/Sao_Paulo e ausência de fallback silencioso de criado_em', () => {
  const cal = normalizarConfigCalendario(BASE_CONFIG);

  // Data YYYY-MM-DD nunca deve ser interpretada como meia-noite UTC (evita voltar 1 dia em BRT)
  assert.equal(getLocalDateKey('2026-11-13'), '2026-11-13');
  assert.equal(formatDateBR('2026-11-13'), '13/11/2026');
  // 2026-11-17T02:00:00.000Z equivale a 2026-11-16 23:00 em America/Sao_Paulo
  assert.equal(getLocalDateKey('2026-11-17T02:00:00.000Z'), '2026-11-16');
  assert.equal(formatDateBR('2026-11-17T02:00:00.000Z'), '16/11/2026');
  assert.match(formatDateTimeBR('2026-11-13T11:00:00.000Z'), /13\/11\/2026.*08:00/);

  // snapFimExpediente gera exatamente 17:00 em America/Sao_Paulo (20:00Z)
  const fimExpIso = snapFimExpediente('2026-11-13', cal);
  assert.equal(formatLocalDateTimeInput(fimExpIso), '2026-11-13T17:00');
  assert.equal(parseDateTimeToMs('2026-11-13T17:00'), new Date(fimExpIso).getTime());

  // Projeto sem data_inicio não deve herdar criado_em silenciosamente
  const projetoSemInicio = makeProjetoTeste({
    data_inicio: undefined,
    criado_em: '2026-11-01T10:00:00.000Z',
    data_entrega: '2026-11-20T20:00:00.000Z',
    prazo: '2026-11-20',
    prazo_horas: 100,
  });
  const datas = resolverDatasEfetivasProjeto(projetoSemInicio, cal);
  assert.equal(datas.dataInicio, undefined);
  assert.equal(datas.dataEntrega, '2026-11-20T20:00:00.000Z');
});

test('Cálculo ao vivo ignora horas_a_executar_por_cc desatualizado quando componentes estão carregados e detecta fila de outros projetos', () => {
  const cfg: Partial<ConfiguracoesSistema> = { ...BASE_CONFIG, contagem_prazo: 'expediente' };
  const inicioMs = zonedDateTimeToUtcMs(2026, 11, 13, 8, 0, 0);
  const entregaIso = adicionarHorasCalendario(inicioMs, 100, normalizarConfigCalendario(cfg));

  const cc2216: CentroCusto = {
    ...CNC_CENTRO,
    id: 'cc-2216',
    nome: '2216',
  };

  // Projeto P tem apenas 10h pendentes reais (40h estimadas - 30h apontadas), mas agregado em cache estava preso em 90h
  const projetoP: any = {
    ...makeProjetoTeste({
      id: 'prj-p',
      codigo: 'PRJ-P',
      data_inicio: new Date(inicioMs).toISOString(),
      data_entrega: entregaIso,
      prazo: '2026-12-01',
      prazo_horas: 100,
      horas_a_executar: 90,
      horas_a_executar_por_cc: { [cc2216.id]: 90 },
    }),
    componentes: [
      {
        id: 'comp-1',
        empresa_id: 'emp-1',
        projeto_id: 'prj-p',
        codigo: 'C-01',
        nome: 'Placa',
        quantidade: 1,
        status: 'Em usinagem',
        operacoes: [
          {
            id: 'op-1',
            empresa_id: 'emp-1',
            componente_id: 'comp-1',
            centro_custo_id: cc2216.id,
            centro_custo: cc2216,
            sequencia: 1,
            descricao: 'Usinagem 2216',
            horas_estimadas: 40,
            status: 'Em execução',
            apontamentos: [
              {
                id: 'apt-1',
                empresa_id: 'emp-1',
                operacao_id: 'op-1',
                operador_id: 'opd-1',
                inicio: '2026-11-01T08:00:00.000Z',
                fim: '2026-11-02T14:00:00.000Z', // 30h
              },
            ],
          },
        ],
      },
    ],
  };

  // Sem outros competidores: 10h vs ~85h capacidade -> Sim
  const avalSozinho = avaliarPrazoProjeto(projetoP, cfg, [cc2216], inicioMs, [projetoP]);
  assert.equal(avalSozinho.statusTempoHabil, 'sim');
  assert.equal(avalSozinho.capacidadesCC[0].cargaProjetoH, 10);
  assert.equal(avalSozinho.capacidadesCC[0].cargaAcumuladaH, 10);

  // Com outro projeto ativo atrasado/anterior ocupando 80h na mesma 2216 -> carga acumulada = 90h > 85h -> Sem tempo hábil
  const projetoAtrasado: Projeto = makeProjetoTeste({
    id: 'prj-antigo',
    codigo: 'PRJ-ANTIGO',
    data_inicio: new Date(zonedDateTimeToUtcMs(2026, 11, 2, 8, 0, 0)).toISOString(),
    data_entrega: new Date(zonedDateTimeToUtcMs(2026, 11, 10, 17, 0, 0)).toISOString(),
    prazo: '2026-11-10',
    status: 'Em andamento',
    horas_a_executar: 80,
    horas_a_executar_por_cc: { [cc2216.id]: 80 },
  });

  const avalComFila = avaliarPrazoProjeto(
    projetoP,
    cfg,
    [cc2216],
    inicioMs,
    [projetoP, projetoAtrasado]
  );
  assert.equal(avalComFila.statusTempoHabil, 'nao');
  assert.equal(avalComFila.capacidadesCC[0].cargaProjetoH, 10);
  assert.equal(avalComFila.capacidadesCC[0].cargaAcumuladaH, 90);
  assert.equal(avalComFila.capacidadesCC[0].projetosContribuintes.length, 2);
});

