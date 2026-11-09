import { PerfilUsuario, ViewTab } from '../types';

/**
 * RECURSOS DO SISTEMA
 */
export type Recurso =
  | 'apontamento'
  | 'painel'
  | 'projetos'
  | 'biblioteca'
  | 'custos'
  | 'clientes'
  | 'centros_custo'
  | 'maquinas'
  | 'operadores'
  | 'usuarios'
  | 'configuracoes';

/**
 * AÇÕES SOBRE OS RECURSOS
 */
export type Acao =
  | 'ver'
  | 'ver_proprio'
  | 'criar'
  | 'criar_proprio'
  | 'editar'
  | 'ajustar'
  | 'excluir'
  | 'importar'
  | 'tudo';

/**
 * MATRIZ CENTRAL DE PERMISSÕES
 * Única fonte de verdade para autorização e controle de acesso no ToolShop ERP.
 * Conforme especificação:
 * - apontamento: operador = criar/ver apenas os próprios; lider = ver e corrigir os da equipe; gerente/admin = tudo
 * - painel: lider, gerente, admin (somente leitura)
 * - projetos: lider = ver; gerente/admin = ver, criar, editar, excluir, importar
 * - biblioteca: lider = ver; gerente/admin = ver, criar, editar, excluir, importar
 * - custos e valores (valor_unitario, custo_hora, custo real): somente gerente e admin
 * - clientes, centros_custo, operadores: gerente/admin = tudo; lider = ver
 * - usuarios: somente admin
 * - configuracoes: gerente e admin = tudo; lider = ver
 */
export const MATRIZ_PERMISSOES: Record<PerfilUsuario, Record<Recurso, readonly Acao[]>> = {
  operador: {
    apontamento: ['ver_proprio', 'criar_proprio'],
    painel: [],
    projetos: [],
    biblioteca: [],
    custos: [],
    clientes: [],
    centros_custo: [],
    maquinas: [],
    operadores: [],
    usuarios: [],
    configuracoes: [],
  },
  lider: {
    apontamento: ['ver', 'ver_proprio', 'criar', 'criar_proprio', 'ajustar'], // ver e corrigir os da equipe
    painel: ['ver'], // somente leitura
    projetos: ['ver'], // somente leitura
    biblioteca: ['ver'], // somente leitura
    custos: [], // sem acesso a custos e valores
    clientes: ['ver'], // somente leitura
    centros_custo: ['ver'], // somente leitura
    maquinas: ['ver'], // somente leitura
    operadores: ['ver'], // somente leitura
    usuarios: [],
    configuracoes: ['ver'],
  },
  gerente: {
    apontamento: ['ver', 'ver_proprio', 'criar', 'criar_proprio', 'ajustar', 'excluir', 'tudo'],
    painel: ['ver'],
    projetos: ['ver', 'criar', 'editar', 'excluir', 'importar', 'tudo'],
    biblioteca: ['ver', 'criar', 'editar', 'excluir', 'importar', 'tudo'],
    custos: ['ver', 'tudo'], // acesso a valor_unitario e custo real
    clientes: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    centros_custo: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    maquinas: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    operadores: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    usuarios: [], // somente admin
    configuracoes: ['ver', 'editar', 'tudo'],
  },
  admin: {
    apontamento: ['ver', 'ver_proprio', 'criar', 'criar_proprio', 'ajustar', 'excluir', 'tudo'],
    painel: ['ver'],
    projetos: ['ver', 'criar', 'editar', 'excluir', 'importar', 'tudo'],
    biblioteca: ['ver', 'criar', 'editar', 'excluir', 'importar', 'tudo'],
    custos: ['ver', 'tudo'],
    clientes: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    centros_custo: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    maquinas: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    operadores: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    usuarios: ['ver', 'criar', 'editar', 'excluir', 'tudo'],
    configuracoes: ['ver', 'editar', 'tudo'],
  },
} as const;

/**
 * Função utilitária central para verificação de permissão:
 * can(perfil, acao, recurso)
 */
export function can(
  perfil: PerfilUsuario | undefined | null,
  acao: Acao,
  recurso: Recurso
): boolean {
  if (!perfil) return false;

  const perfilRules = MATRIZ_PERMISSOES[perfil];
  if (!perfilRules) return false;

  const acoesPermitidas = perfilRules[recurso] || [];

  // Se tem a ação "tudo", tem acesso a todas as operações no recurso
  if (acoesPermitidas.includes('tudo')) {
    return true;
  }

  // Se requer "ver_proprio", mas tem "ver", também é permitido
  if (acao === 'ver_proprio' && acoesPermitidas.includes('ver')) {
    return true;
  }

  // Se requer "criar_proprio", mas tem "criar", também é permitido
  if (acao === 'criar_proprio' && acoesPermitidas.includes('criar')) {
    return true;
  }

  return acoesPermitidas.includes(acao);
}

/**
 * Verifica se um perfil tem acesso a uma determinada aba do menu
 */
export function canAccessTab(
  perfil: PerfilUsuario | undefined | null,
  tab: ViewTab
): boolean {
  if (!perfil) return false;

  switch (tab) {
    case 'painel':
      return can(perfil, 'ver', 'painel');
    case 'projetos':
      return can(perfil, 'ver', 'projetos');
    case 'biblioteca':
      return can(perfil, 'ver', 'biblioteca');
    case 'centros_custo':
    case 'maquinas':
      return can(perfil, 'ver', 'centros_custo') || can(perfil, 'ver', 'maquinas');
    case 'operadores':
      return can(perfil, 'ver', 'operadores');
    case 'clientes':
      return can(perfil, 'ver', 'clientes');
    case 'apontamento':
      return can(perfil, 'ver', 'apontamento') || can(perfil, 'ver_proprio', 'apontamento');
    case 'usuarios':
      return can(perfil, 'ver', 'usuarios');
    case 'configuracoes':
      return can(perfil, 'ver', 'configuracoes');
    case 'sem_permissao':
      return true;
    default:
      return false;
  }
}


/**
 * Retorna a aba inicial padrão com base no perfil do usuário
 * Operador cai direto na tela de Apontamento.
 */
export function getDefaultTabForPerfil(perfil: PerfilUsuario): ViewTab {
  if (perfil === 'operador') {
    return 'apontamento';
  }
  return 'painel';
}

/**
 * Informações visuais e semânticas dos perfis de usuário
 */
export const PERFIL_CONFIG: Record<
  PerfilUsuario,
  {
    label: string;
    description: string;
    badgeClass: string;
    tipoLogin: 'matricula_pin' | 'email_senha';
    inactivityMinutes: number;
  }
> = {
  operador: {
    label: 'Operador',
    description: 'Chão de fábrica: apontamento em tablet e registro de turno',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    tipoLogin: 'matricula_pin',
    inactivityMinutes: 5, // Sessão mais curta para tablet compartilhado
  },
  lider: {
    label: 'Líder de Ferramentaria',
    description: 'Chão de fábrica & supervisão: visualização e correção de apontamentos',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    tipoLogin: 'matricula_pin',
    inactivityMinutes: 15,
  },
  gerente: {
    label: 'Gerente Industrial',
    description: 'Gestão operacional completa, orçamentos, custos reais e projetos',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    tipoLogin: 'email_senha',
    inactivityMinutes: 30,
  },
  admin: {
    label: 'Administrador',
    description: 'Controle irrestrito do sistema e gestão de contas de usuários',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    tipoLogin: 'email_senha',
    inactivityMinutes: 30,
  },
};
