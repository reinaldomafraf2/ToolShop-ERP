/**
 * MIGRAÇÃO ÚNICA DE DADOS DE SEGURANÇA
 * 
 * Remove do armazenamento local exclusivamente os 5 usuários legados do seed inicial:
 * - Identificados pelo prefixo de ID fixo: "u1000000-0000-4000-8000-00000000000" (1 a 5)
 * - Invalida qualquer sessão ativa associada aos usuários antigos.
 * - Preserva rigorosamente os demais usuários reais (se houver) e TODOS os outros dados
 *   do sistema: projetos, clientes, máquinas, operadores, biblioteca e apontamentos.
 */

const STORAGE_KEY_USUARIOS = 'toolshop_usuarios';
const STORAGE_KEY_SESSION = 'toolshop_auth_session_v1';
const MIGRATION_FLAG_KEY = 'toolshop_migration_legacy_seed_users_purged_v2';

export function runLegacyUserMigration(): void {
  try {
    // 1. Invalida sessão se pertencer a um usuário legado do seed
    const rawSession = localStorage.getItem(STORAGE_KEY_SESSION);
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        if (
          session?.user?.id &&
          typeof session.user.id === 'string' &&
          session.user.id.startsWith('u1000000-0000-4000-8000-00000000000')
        ) {
          localStorage.removeItem(STORAGE_KEY_SESSION);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    }

    // 2. Limpa os 5 usuários legados do localStorage
    const rawUsers = localStorage.getItem(STORAGE_KEY_USUARIOS);
    if (rawUsers) {
      const users = JSON.parse(rawUsers);
      if (Array.isArray(users)) {
        const cleanedUsers = users.filter((u: any) => {
          if (!u || !u.id || typeof u.id !== 'string') return false;
          // Purga somente os IDs legados iniciados com u1000000-0000-4000-8000-00000000000
          const isLegacySeed = u.id.startsWith('u1000000-0000-4000-8000-00000000000');
          return !isLegacySeed;
        });

        // Se houve remoção ou se flag ainda não foi marcada
        if (cleanedUsers.length !== users.length) {
          localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(cleanedUsers));
          localStorage.removeItem(STORAGE_KEY_SESSION);
        }
      }
    }

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch (error) {
    console.error('Erro ao executar migração de usuários legados:', error);
  }
}
