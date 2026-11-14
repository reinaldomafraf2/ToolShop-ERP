export type OrigemCentroCusto = 'interno' | 'terceirizado';
export type ModeloCusto = 'hora' | 'peca' | 'kg' | 'servico';

export const CATEGORIAS_CENTRO_CUSTO_SUGESTO = [
  'Programação',
  'CNC',
  'Eletroerosão',
  'Retífica',
  'Torno',
  'Fresa',
  'Ajustagem/Bancada',
  'Tratamento térmico',
  'Tratamento superficial',
  'Polimento',
  'Corte',
  'Outro',
] as const;

export type TipoMaquina = string;

export interface CentroCusto {
  id: string; // UUID
  empresa_id: string; // UUID
  nome: string;
  origem: OrigemCentroCusto;
  categoria: string; // CNC, Eletroerosão, Retífica, Torno, Fresa, Ajustagem/Bancada, Tratamento térmico, Tratamento superficial, Polimento, Corte, Outro
  modelo_custo: ModeloCusto; // 'hora' | 'peca' | 'kg' | 'servico'
  valor_unitario: number; // R$
  fornecedor_nome?: string;
  fornecedor_contato?: string;
  prazo_padrao_dias?: number; // Usado só em terceirizado
  // Capacidade (apenas centros internos)
  capacidade_paralela?: number; // Número de máquinas ou pessoas equivalentes (padrão 1)
  horas_por_dia?: number; // Opcional; padrão = horas de expediente por dia
  disponibilidade_percentual?: number; // Opcional; padrão da configuração (85%)
  ativo: boolean;
  observacoes?: string;

  // Compatibilidade legada transitória
  /** @deprecated use categoria */
  tipo?: string;
  /** @deprecated use valor_unitario */
  custo_hora?: number;
}

// Alias de retrocompatibilidade para código existente
export type Maquina = CentroCusto;

export type StatusProjeto = 'Aguardando' | 'Em andamento' | 'Em tryout' | 'Concluído' | 'Cancelado';
export type StatusComponente = 'Pendente' | 'Em produção' | 'Concluído';
export type StatusOperacao = 'Pendente' | 'Em andamento' | 'Concluída' | 'Enviada' | 'Retornada';

export interface Cliente {
  id: string; // UUID
  empresa_id: string; // UUID
  nome: string;
  contato: string;
}

export interface Operador {
  id: string; // UUID
  empresa_id: string; // UUID
  nome: string;
}

export type PrazoOrigem = 'horas' | 'data';

export interface Projeto {
  id: string; // UUID
  empresa_id: string; // UUID
  cliente_id: string; // UUID
  codigo: string;
  orcamento_codigo?: string; // Código do orçamento (texto)
  planejador?: string; // Planejador responsável (texto)
  descricao: string;
  prazo: string; // YYYY-MM-DD (mantido em sincronia com data_entrega para compatibilidade)
  data_inicio?: string; // ISO datetime (padrão = momento da criação)
  data_entrega?: string; // ISO datetime (padrão = fim do expediente do dia escolhido)
  prazo_horas?: number; // Janela de calendário entre data_inicio e data_entrega (conforme contagem_prazo)
  prazo_origem?: PrazoOrigem; // 'horas' | 'data'
  // Agregados mantidos transacionalmente no documento do projeto (apenas operações internas)
  horas_consumidas?: number;
  horas_estimadas_total?: number;
  horas_a_executar?: number;
  horas_a_executar_por_cc?: Record<string, number>;
  criado_em?: string;
  atualizado_em?: string;
  status: StatusProjeto;
}

export type TipoComponente = 'fabricado' | 'comprado' | 'estoque';

export interface Componente {
  id: string; // UUID
  empresa_id: string; // UUID
  projeto_id: string; // UUID
  codigo?: string; // Código técnico ou de rastreabilidade
  nome: string;
  quantidade: number; // Inteiro >= 1, padrão 1
  material: string;
  tipo?: TipoComponente; // 'fabricado' | 'comprado' | 'estoque' (padrão 'fabricado')
  formato?: string; // ex.: 'BLOCO', 'REDONDO', 'TUBO', 'CHAPA', 'OUTRO'
  dimensoes?: string;
  peso_kg?: number; // Peso em kg (número, opcional)
  peso_calculado?: boolean; // Se foi calculado automaticamente a partir do bloco
  tratamento?: string; // 2ª coluna de observações (tratamento/acabamento)
  id_refer_pai?: string;
  num_lista?: string;
  data_lista?: string;
  fornecedor_material?: string; // Fornecedor sugerido para matéria-prima ou item comprado
  observacoes?: string;
  status: StatusComponente;
  modelo_origem_id?: string; // UUID do modelo da biblioteca (se aplicável)
}

export interface Operacao {
  id: string; // UUID
  empresa_id: string; // UUID
  componente_id: string; // UUID
  centro_custo_id: string; // UUID do Centro de Custo
  maquina_id?: string; // Legado para compatibilidade
  sequencia: number;
  descricao: string;
  instrucoes?: string; // Instruções longas de execução / Plano de fabricação (até 5.000 caracteres)
  horas_estimadas?: number; // Opcional se terceirizado
  status: StatusOperacao;

  // Campos específicos de operações terceirizadas
  prazo_dias?: number;
  peso_kg?: number;
  fornecedor?: string;
  data_envio?: string; // YYYY-MM-DD
  retorno_previsto?: string; // YYYY-MM-DD
  data_retorno_real?: string; // YYYY-MM-DD
  valor_orcado?: number; // R$ orçado estimado
  valor_real?: number; // R$ efetivo cobrado
  documento?: string; // NF, pedido, etc.
  observacoes?: string;
}

export interface Apontamento {
  id: string; // UUID
  empresa_id: string; // UUID
  operacao_id: string; // UUID
  operador_id: string; // UUID
  inicio: string; // ISO string
  fim: string | null; // ISO string or null if ongoing
  editado_manualmente?: boolean;
  motivo_edicao?: string;
}

// --- MODELOS DA BIBLIOTECA (COMPONENTES-MODELO & ROTEIROS PADRÃO) ---
export interface ModeloOperacao {
  id: string; // UUID
  modelo_componente_id: string; // UUID
  sequencia: number;
  descricao: string;
  instrucoes?: string; // Instruções longas de execução / Plano de fabricação (até 5.000 caracteres)
  categoria: string; // Categoria do Centro de Custo (antigo tipo_maquina)
  tipo_maquina?: string; // Legado para compatibilidade
  centro_custo_id?: string; // UUID opcional do centro de custo preferencial
  maquina_id?: string; // Legado
  horas_estimadas?: number;
  prazo_dias?: number;
  fornecedor?: string;
  peso_kg?: number;
  valor_orcado?: number;
}

export interface ModeloComponente {
  id: string; // UUID
  empresa_id: string; // UUID
  codigo: string; // Texto, obrigatório e único por empresa
  nome: string;
  categoria: string;
  material: string;
  formato?: string;
  dimensoes?: string;
  peso_kg?: number;
  peso_calculado?: boolean;
  tratamento?: string;
  observacoes?: string;
  operacoes: ModeloOperacao[];
  criado_em?: string;
}

export interface HistoricoImportacao {
  id: string; // UUID
  empresa_id: string; // UUID
  usuario_id: string;
  usuario_nome: string;
  tipo: 'componentes_projeto' | 'biblioteca_modelos';
  arquivo_nome: string;
  total_linhas: number;
  linhas_sucesso: number;
  linhas_erro: number;
  data_hora: string; // ISO string
  detalhes?: string;
}

// Modelos enriquecidos para exibição em listas e detalhes
export interface ProjetoComDetalhes extends Projeto {
  cliente?: Cliente;
  componentes: ComponenteComOperacoes[];
  totalComponentes: number;
  totalOperacoes: number;
  operacoesConcluidasCount: number;
  horasEstimadasTotal: number;
  horasApontadasTotal: number;
  custoInterno: number; // Σ(horas apontadas × taxa horária do posto)
  custoTerceiros: number; // Σ(valor_real ?? valor_orcado)
  custoTerceirosEstimado: number; // Σ(valor_orcado em aberto)
  custoTerceirosReal: number; // Σ(valor_real faturado)
  custoRealAcumulado: number; // custoInterno + custoTerceiros
  operacoesTerceirosEnviadasCount?: number;
}

export type MaterialStatusComponente =
  | 'pendente'
  | 'solicitado'
  | 'comprado'
  | 'parcial'
  | 'recebido'
  | 'retirado';

export type ModoOperacaoSemMaterial = 'ignorar' | 'avisar' | 'bloquear';

export interface ComponenteComOperacoes extends Componente {
  operacoes: OperacaoComDetalhes[];
  material_status?: MaterialStatusComponente;
}

export interface OperacaoComDetalhes extends Operacao {
  centro_custo?: CentroCusto;
  maquina?: CentroCusto; // Legado para compatibilidade
  componente?: Componente;
  projeto?: Projeto;
  apontamentos: ApontamentoComOperador[];
  horasApontadas: number;
  custoAcumulado: number;
}

export interface ApontamentoComOperador extends Apontamento {
  operador?: Operador;
  operacao?: Operacao;
  centro_custo?: CentroCusto;
  maquina?: CentroCusto; // Legado para compatibilidade
  projeto?: Projeto;
  componente?: Componente;
  duracaoHoras: number;
}

export type PerfilUsuario = 'operador' | 'lider' | 'gerente' | 'admin';

export interface Usuario {
  id: string; // UUID
  empresa_id: string; // UUID
  nome: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  operador_id?: string; // UUID do Operador associado (opcional)
  // Credenciais armazenadas com PBKDF2 (salt individual e mínimo 200.000 iterações)
  matricula?: string; // Para operador e lider
  pin_hash?: string; // Hash PBKDF2 do PIN numérico (4 a 6 dígitos)
  pin_salt?: string; // Salt aleatório por usuário
  pin_iter?: number; // Mínimo 200.000 iterações
  email?: string; // Para gerente e admin
  senha_hash?: string; // Hash PBKDF2 da senha
  senha_salt?: string; // Salt aleatório por usuário
  senha_iter?: number; // Mínimo 200.000 iterações
  criado_em?: string; // ISO string
  ultimo_login?: string; // ISO string
}

export interface OperadorCentroCusto {
  id: string; // UUID
  empresa_id: string; // UUID
  operador_id: string; // UUID do Operador
  centro_custo_id: string; // UUID do Centro de Custo interno
  criado_em: string; // ISO string
  atualizado_por?: string; // Nome do usuário que realizou a alteração
  atualizado_em?: string; // ISO string
}

export type ContagemPrazo = 'corridas' | 'expediente';

export interface FeriadoCalendario {
  data: string; // YYYY-MM-DD
  nome: string;
}

export interface ConfiguracoesSistema {
  id: string; // UUID ou 'config_padrao'
  empresa_id: string;
  restringir_postos: boolean; // Padrão: true (Restringir operadores aos seus postos de trabalho)
  liberar_apenas_proxima_operacao: boolean; // Padrão: false (Liberar uma operação somente quando a anterior estiver concluída)

  // Configurações da Empresa (tela só para admin: Folha de Processos / Plano de Fabricação)
  empresa_nome?: string;
  empresa_cnpj?: string;
  empresa_endereco?: string;
  empresa_telefone?: string;
  empresa_logo?: string; // Imagem opcional em Base64 Data URL (até 500 KB)

  // Configurações de Compras & Produção
  avisar_operador_material_pendente?: boolean; // Legado/compatibilidade
  operacoes_sem_material_recebido?: ModoOperacaoSemMaterial; // 'ignorar' | 'avisar' | 'bloquear' (Padrão: 'avisar')
  categorias_isentas_bloqueio_material?: string[]; // Padrão: ['Programação']

  // Configurações de Estoque
  permitir_saldo_negativo?: boolean; // Padrão: false (Permitir saída ou reserva acima do saldo disponível)
  dias_alerta_reserva_parada?: number; // Padrão: 30 (Alerta de reservas ativas paradas há mais de N dias)

  // Configurações de Calendário de Trabalho e Prazos
  contagem_prazo?: ContagemPrazo; // 'corridas' (padrão) | 'expediente'
  expediente_dias_semana?: number[]; // 0=Dom..6=Sáb (padrão: [1,2,3,4,5])
  expediente_inicio?: string; // HH:mm (padrão: '08:00')
  expediente_fim?: string; // HH:mm (padrão: '17:00')
  expediente_almoco_horas?: number; // horas de intervalo (padrão: 1)
  feriados?: FeriadoCalendario[]; // Lista de feriados
  atencao_percentual?: number; // Padrão: 15 (%)
  disponibilidade_percentual_padrao?: number; // Padrão: 85 (%)

  atualizado_por?: string;
  atualizado_em?: string;
}

export type ViewTab =
  | 'painel'
  | 'projetos'
  | 'compras'
  | 'estoque'
  | 'biblioteca'
  | 'centros_custo'
  | 'maquinas'
  | 'operadores'
  | 'clientes'
  | 'apontamento'
  | 'usuarios'
  | 'configuracoes'
  | 'sincronizacao'
  | 'sem_permissao';

// =========================================================================
// MÓDULO: COMPRAS E MATERIAIS
// =========================================================================

export interface Fornecedor {
  id: string; // UUID
  empresa_id: string; // UUID
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  prazo_padrao_dias?: number;
  observacoes?: string;
  ativo: boolean;
  criado_em?: string;
}

export type TipoItemCompra = 'materia_prima' | 'item_comercial' | 'reposicao';
export type UnidadeItemCompra = 'un' | 'kg' | 'm' | 'pç';
export type StatusItemCompra =
  | 'a_solicitar'
  | 'solicitado'
  | 'comprado'
  | 'recebido'
  | 'cancelado'
  | 'atendido_estoque';

export interface RecebimentoItemCompraRegistro {
  id: string;
  data_recebimento: string; // YYYY-MM-DD
  quantidade: number;
  nota_fiscal?: string;
  item_estoque_id: string;
  movimento_id: string;
  unidade_ids?: string[];
  etiquetas?: string[];
  reserva_ids?: string[];
  destinado_projeto?: boolean;
  usuario_id: string;
  usuario_nome?: string;
  criado_em: string;
  estornado?: boolean;
  estornado_em?: string;
  estornado_por?: string;
  estorno_movimento_ids?: string[];
}

export interface ItemCompra {
  id: string; // UUID
  empresa_id: string; // UUID
  projeto_id?: string; // UUID (opcional para reposição ou compras gerais)
  componente_id?: string; // UUID (origem, opcional para reposição)
  item_estoque_id?: string; // UUID do ItemEstoque vinculado
  movimento_entrada_id?: string; // UUID do MovimentoEstoque de entrada gerado (último ou único)
  movimento_entrada_ids?: string[]; // UUIDs de todos movimentos de entrada (recebimentos parciais)
  etiquetas_criadas?: string[]; // Etiquetas PE-... geradas nos recebimentos
  tipo: TipoItemCompra; // 'materia_prima' | 'item_comercial' | 'reposicao'
  descricao: string;
  especificacao: string; // material, formato e dimensões em texto
  quantidade: number;
  quantidade_recebida?: number; // Acumulado já recebido (padrão 0)
  quantidade_pendente?: number; // Saldo restante a receber
  unidade: UnidadeItemCompra; // 'un' | 'kg' | 'm' | 'pç'
  peso_kg?: number;
  fornecedor_id?: string;
  numero_lista?: string;
  data_lista?: string;
  status: StatusItemCompra;
  data_solicitacao?: string; // YYYY-MM-DD
  numero_pedido?: string;
  previsao_entrega?: string; // YYYY-MM-DD
  data_recebimento?: string; // YYYY-MM-DD
  nota_fiscal?: string;
  observacoes?: string;
  valor_estimado?: number;
  valor_real?: number;
  historico_recebimentos?: RecebimentoItemCompraRegistro[];
  estornado_em?: string;
  estornado_por?: string;
  estorno_movimento_ids?: string[];
  criado_em: string; // ISO string
}

export interface ItemCompraComDetalhes extends ItemCompra {
  projeto?: Projeto;
  componente?: Componente;
  fornecedor?: Fornecedor;
  item_estoque?: ItemEstoque;
  atrasado?: boolean;
  diasAtraso?: number;
  pode_estornar?: boolean;
  motivo_bloqueio_estorno?: string;
}

// =========================================================================
// MÓDULO: ESTOQUE E MATERIAIS
// =========================================================================

export type CategoriaItemEstoque =
  | 'materia_prima'
  | 'item_comercial'
  | 'consumivel'
  | 'outro';

export type TipoControleEstoque = 'quantidade' | 'unidade_fisica';
export type UnidadeMedidaEstoque = 'un' | 'kg' | 'm' | 'pç';

export interface ItemEstoque {
  id: string; // UUID
  empresa_id: string; // UUID
  codigo: string; // único por empresa
  descricao: string;
  categoria: CategoriaItemEstoque;
  unidade: UnidadeMedidaEstoque;
  especificacao: string; // material, norma, dimensões em texto
  tipo_controle: TipoControleEstoque;
  estoque_minimo?: number;
  localizacao_padrao?: string;
  saldo: number; // mantido por transação atômica
  custo_medio?: number; // Custo médio móvel (R$) mantido nas entradas
  ativo: boolean;
  criado_em: string; // ISO string
}

export type StatusUnidadeEstoque =
  | 'disponivel'
  | 'reservada'
  | 'consumida'
  | 'descartada';

export type OrigemUnidadeEstoque = 'compra' | 'sobra' | 'ajuste';

export interface UnidadeEstoque {
  id: string; // UUID
  empresa_id: string; // UUID
  item_id: string; // UUID do ItemEstoque pai
  etiqueta: string; // código único legível, ex: 'PE-2026-0001', 'SOB-0042'
  material?: string;
  formato?: string; // BLOCO, BARRA_REDONDA, BARRA_CHATA, TUBO, CHAPA, OUTRO
  comprimento_mm?: number;
  largura_mm?: number;
  espessura_mm?: number;
  diametro_mm?: number; // para barras cilíndricas
  peso_kg?: number;
  custo_unitario?: number; // Custo próprio da peça física (R$)
  lote_ou_certificado?: string;
  localizacao?: string;
  origem: OrigemUnidadeEstoque;
  origem_projeto_id?: string;
  origem_componente_id?: string;
  origem_item_compra_id?: string;
  numero_pedido?: string;
  nota_fiscal?: string;
  fornecedor_nome?: string;
  status: StatusUnidadeEstoque;
  observacoes?: string;
  criado_em: string; // ISO string
}

export type TipoMovimentoEstoque = 'entrada' | 'saida' | 'ajuste';

export type MotivoMovimentoEstoque =
  | 'compra'
  | 'producao'
  | 'inventario'
  | 'perda'
  | 'devolucao'
  | 'outro';

export interface MovimentoEstoque {
  id: string; // UUID
  empresa_id: string; // UUID
  item_id: string; // UUID do ItemEstoque
  unidade_id?: string; // UUID da UnidadeEstoque quando for peça física
  tipo: TipoMovimentoEstoque;
  quantidade: number; // sempre positiva
  data_hora: string; // ISO string
  usuario_id: string;
  usuario_nome?: string;
  projeto_id?: string;
  componente_id?: string;
  item_compra_id?: string;
  numero_pedido?: string;
  nota_fiscal?: string;
  fornecedor_nome?: string;
  movimento_estornado_id?: string;
  motivo: MotivoMovimentoEstoque;
  custo_unitario?: number; // Custo unitário no momento do movimento (R$)
  custo_total?: number; // Quantidade * custo_unitario (R$)
  observacoes?: string;
}

export type StatusReservaEstoque = 'ativa' | 'consumida' | 'cancelada';

export interface ReservaEstoque {
  id: string; // UUID
  empresa_id: string; // UUID
  item_id: string; // UUID do ItemEstoque
  unidade_id?: string; // UUID da UnidadeEstoque se for peça específica
  quantidade: number;
  projeto_id?: string;
  componente_id?: string;
  status: StatusReservaEstoque;
  criado_em: string; // ISO string
}

export interface SugestaoEstoqueItem {
  tipo: 'item' | 'sobra';
  itemId: string;
  itemCodigo: string;
  itemDescricao: string;
  disponivel: number;
  unidade: string;
  unidadeId?: string;
  etiqueta?: string;
  dimensoes?: string;
  peso_kg?: number;
  localizacao?: string;
}

// Modelos enriquecidos para exibição em tabelas e drawers
export interface ItemEstoqueComDetalhes extends ItemEstoque {
  reservado: number;
  disponivel: number;
  abaixo_minimo: boolean;
  total_unidades_fisicas?: number;
  unidades_disponiveis?: UnidadeEstoque[];
}

export interface UnidadeEstoqueComDetalhes extends UnidadeEstoque {
  item?: ItemEstoque;
  origem_projeto_codigo?: string;
  origem_componente_nome?: string;
}

export interface MovimentoEstoqueComDetalhes extends MovimentoEstoque {
  item?: ItemEstoque;
  unidade?: UnidadeEstoque;
  projeto_codigo?: string;
  componente_nome?: string;
}

export interface ReservaEstoqueComDetalhes extends ReservaEstoque {
  item?: ItemEstoque;
  unidade?: UnidadeEstoque;
  projeto_codigo?: string;
  componente_nome?: string;
}



