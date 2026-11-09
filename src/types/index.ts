export type OrigemCentroCusto = 'interno' | 'terceirizado';
export type ModeloCusto = 'hora' | 'peca' | 'kg' | 'servico';

export const CATEGORIAS_CENTRO_CUSTO_SUGESTO = [
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

export interface Projeto {
  id: string; // UUID
  empresa_id: string; // UUID
  cliente_id: string; // UUID
  codigo: string;
  descricao: string;
  prazo: string; // YYYY-MM-DD
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
  dimensoes?: string;
  tratamento?: string; // 2ª coluna de observações (tratamento/acabamento)
  id_refer_pai?: string;
  num_lista?: string;
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

export interface ComponenteComOperacoes extends Componente {
  operacoes: OperacaoComDetalhes[];
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

export type ViewTab =
  | 'painel'
  | 'projetos'
  | 'biblioteca'
  | 'centros_custo'
  | 'maquinas'
  | 'operadores'
  | 'clientes'
  | 'apontamento'
  | 'usuarios'
  | 'sem_permissao';

