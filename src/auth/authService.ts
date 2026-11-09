import { Usuario, PerfilUsuario } from '../types';
import { usuarioRepository } from '../repositories/firestoreRepositories';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import {
  hashSecretPBKDF2,
  verifySecretPBKDF2,
  MIN_PBKDF2_ITERATIONS,
} from './crypto';
import { PERFIL_CONFIG } from './permissions';
import { DEFAULT_EMPRESA_ID } from '../utils/uuid';
import { runLegacyUserMigration } from './migration';

const SESSION_STORAGE_KEY = 'toolshop_auth_session_v1';

export interface AuthSession {
  user: Usuario;
  loginAt: string; // ISO
  lastActivity: number; // timestamp ms
  timeoutMinutes: number;
}

export interface CriarUsuarioDTO {
  nome: string;
  perfil: PerfilUsuario;
  operador_id?: string;
  ativo?: boolean;
  matricula?: string;
  pin?: string;
  email?: string;
  senha?: string;
}

export interface AtualizarUsuarioDTO {
  nome?: string;
  perfil?: PerfilUsuario;
  operador_id?: string;
  ativo?: boolean;
  matricula?: string;
  email?: string;
}

class AuthService {
  constructor() {
    // Garante a migração segura ao inicializar
    runLegacyUserMigration();
  }

  /**
   * Verifica se existe pelo menos um administrador ativo no sistema
   */
  async hasActiveAdmin(): Promise<boolean> {
    const all = await usuarioRepository.getAll();
    return all.some((u) => u.perfil === 'admin' && u.ativo);
  }

  /**
   * Login por Matrícula e PIN numérico (Operador e Líder)
   */
  async loginComMatricula(matricula: string, pin: string): Promise<Usuario> {
    const cleanMatricula = (matricula || '').trim().toUpperCase();
    const cleanPin = (pin || '').trim();

    if (!cleanMatricula) {
      throw new Error('Informe a matrícula do operador ou líder.');
    }

    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      throw new Error('O PIN deve conter entre 4 e 6 dígitos numéricos.');
    }

    const user = await usuarioRepository.getByMatricula(cleanMatricula);
    if (!user) {
      throw new Error('Matrícula não cadastrada no sistema.');
    }

    if (!user.ativo) {
      throw new Error('Esta conta de usuário está desativada. Procure o administrador.');
    }

    if (user.perfil !== 'operador' && user.perfil !== 'lider') {
      throw new Error('Este perfil deve efetuar login através de E-mail e Senha corporativa.');
    }

    const isValid = await verifySecretPBKDF2(
      cleanPin,
      user.pin_hash,
      user.pin_salt,
      user.pin_iter || MIN_PBKDF2_ITERATIONS
    );

    if (!isValid) {
      throw new Error('PIN incorreto. Verifique seus dígitos e tente novamente.');
    }

    // Atualiza data do último login
    const updated = await usuarioRepository.update(user.id, {
      ultimo_login: new Date().toISOString(),
    });

    this.saveSession(updated);
    return updated;
  }

  /**
   * Login por E-mail e Senha (Gerente e Administrador)
   */
  async loginComEmail(email: string, senha: string): Promise<Usuario> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanSenha = (senha || '').trim();

    if (!cleanEmail) {
      throw new Error('Informe o e-mail de acesso corporativo.');
    }

    if (!cleanSenha) {
      throw new Error('Informe a senha.');
    }

    const user = await usuarioRepository.getByEmail(cleanEmail);
    if (!user) {
      throw new Error('E-mail não cadastrado no sistema.');
    }

    if (!user.ativo) {
      throw new Error('Esta conta de usuário está desativada. Procure o administrador.');
    }

    if (user.perfil !== 'gerente' && user.perfil !== 'admin') {
      throw new Error('Operadores e Líderes devem efetuar login via Matrícula e PIN no Chão de Fábrica.');
    }

    const isValid = await verifySecretPBKDF2(
      cleanSenha,
      user.senha_hash,
      user.senha_salt,
      user.senha_iter || MIN_PBKDF2_ITERATIONS
    );

    if (!isValid) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    // Atualiza data do último login
    const updated = await usuarioRepository.update(user.id, {
      ultimo_login: new Date().toISOString(),
    });

    this.saveSession(updated);
    return updated;
  }

  /**
   * Salva sessão ativa com tempo de inatividade configurado por perfil
   */
  private saveSession(user: Usuario): void {
    const timeoutMinutes = PERFIL_CONFIG[user.perfil]?.inactivityMinutes || 15;
    const session: AuthSession = {
      user,
      loginAt: new Date().toISOString(),
      lastActivity: Date.now(),
      timeoutMinutes,
    };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Erro ao salvar sessão de autenticação:', e);
    }
  }

  /**
   * Recupera a sessão atual gravada no localStorage
   */
  getSession(): AuthSession | null {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!data) return null;
      const session = JSON.parse(data) as AuthSession;

      // Valida expiração por inatividade
      if (this.isSessionExpired(session)) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Verifica se a sessão expirou por inatividade
   */
  isSessionExpired(session: AuthSession | null = this.getSession()): boolean {
    if (!session) return true;
    const now = Date.now();
    const elapsedMinutes = (now - session.lastActivity) / (1000 * 60);
    return elapsedMinutes >= session.timeoutMinutes;
  }

  /**
   * Atualiza o timestamp de última atividade do usuário
   */
  touchActivity(): void {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!data) return;
      const session = JSON.parse(data) as AuthSession;
      session.lastActivity = Date.now();
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignora erro
    }
  }

  /**
   * Autenticação via Google Firebase
   */
  async loginComGoogle(): Promise<Usuario> {
    const res = await signInWithPopup(auth, googleProvider);
    if (!res.user || !res.user.email) {
      throw new Error('Falha ao autenticar com a conta Google.');
    }
    const emailNorm = res.user.email.toLowerCase().trim();
    let usuario = await usuarioRepository.getByEmail(emailNorm);

    // Se usuário não existe, mas é o email do administrador autorizado da aplicação
    if (!usuario && (emailNorm === 'reinaldo.mafraf2@gmail.com' || (await usuarioRepository.getAll()).length === 0)) {
      usuario = await usuarioRepository.create({
        nome: res.user.displayName || 'Administrador',
        email: emailNorm,
        perfil: 'admin',
        ativo: true,
      });
    }

    if (!usuario) {
      await signOut(auth).catch(() => {});
      throw new Error(`A conta Google "${emailNorm}" não está cadastrada no ToolShop ERP. Solicite ao administrador o cadastro do seu e-mail.`);
    }

    if (!usuario.ativo) {
      await signOut(auth).catch(() => {});
      throw new Error('Este usuário está inativo no sistema.');
    }

    const session: AuthSession = {
      user: usuario,
      loginAt: new Date().toISOString(),
      lastActivity: Date.now(),
      timeoutMinutes: PERFIL_CONFIG[usuario.perfil]?.inactivityMinutes || 15,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return usuario;
  }

  /**
   * Encerra a sessão
   */
  logout(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      signOut(auth).catch(() => {});
    } catch {
      // Ignora erro
    }
  }

  // =========================================================================
  // GESTÃO DE PRIMEIRO ADMINISTRADOR
  // =========================================================================

  /**
   * Cria o primeiro administrador do sistema quando nenhum admin ativo existe
   */
  async criarPrimeiroAdmin(dados: {
    nome: string;
    email: string;
    senha: string;
    confirmacaoSenha?: string;
  }): Promise<Usuario> {
    const hasAdmin = await this.hasActiveAdmin();
    if (hasAdmin) {
      throw new Error('Já existe um administrador configurado no sistema.');
    }

    const cleanNome = (dados.nome || '').trim();
    const cleanEmail = (dados.email || '').trim().toLowerCase();
    const cleanSenha = (dados.senha || '').trim();

    if (!cleanNome) {
      throw new Error('O nome do administrador é obrigatório.');
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Informe um endereço de e-mail corporativo válido.');
    }

    if (cleanSenha.length < 8) {
      throw new Error('A senha deve conter no mínimo 8 caracteres.');
    }

    if (dados.confirmacaoSenha !== undefined && cleanSenha !== dados.confirmacaoSenha.trim()) {
      throw new Error('A confirmação da senha não confere com a senha digitada.');
    }

    // Derivação de chave PBKDF2 (salt aleatório + 200.000 iterações)
    const { hash, salt, iterations } = await hashSecretPBKDF2(cleanSenha);

    const novoAdmin = await usuarioRepository.create({
      empresa_id: DEFAULT_EMPRESA_ID,
      nome: cleanNome,
      perfil: 'admin',
      ativo: true,
      email: cleanEmail,
      senha_hash: hash,
      senha_salt: salt,
      senha_iter: iterations,
      criado_em: new Date().toISOString(),
      ultimo_login: new Date().toISOString(),
    });

    this.saveSession(novoAdmin);
    return novoAdmin;
  }

  // =========================================================================
  // AUTOATENDIMENTO: ALTERAR MINHA SENHA / PIN
  // =========================================================================

  /**
   * Permite a qualquer usuário logado alterar sua própria senha ou PIN
   */
  async alterarPropriaSenha(
    usuarioId: string,
    credencialAtual: string,
    novaCredencial: string,
    confirmacao: string
  ): Promise<void> {
    const user = await usuarioRepository.getById(usuarioId);
    if (!user) {
      throw new Error('Usuário não localizado no sistema.');
    }

    const cleanAtual = (credencialAtual || '').trim();
    const cleanNova = (novaCredencial || '').trim();
    const cleanConf = (confirmacao || '').trim();

    if (!cleanAtual) {
      throw new Error('Informe sua credencial atual.');
    }

    if (!cleanNova) {
      throw new Error('Informe a nova credencial.');
    }

    if (cleanNova !== cleanConf) {
      throw new Error('A nova credencial e a confirmação não conferem.');
    }

    const isPinProfile = user.perfil === 'operador' || user.perfil === 'lider';

    if (isPinProfile) {
      // Validação de PIN
      if (cleanNova.length < 4 || cleanNova.length > 6 || !/^\d+$/.test(cleanNova)) {
        throw new Error('O novo PIN deve conter entre 4 e 6 dígitos numéricos.');
      }

      const isValidAtual = await verifySecretPBKDF2(
        cleanAtual,
        user.pin_hash,
        user.pin_salt,
        user.pin_iter || MIN_PBKDF2_ITERATIONS
      );

      if (!isValidAtual) {
        throw new Error('O PIN atual informado está incorreto.');
      }

      const { hash, salt, iterations } = await hashSecretPBKDF2(cleanNova);

      const updated = await usuarioRepository.update(user.id, {
        pin_hash: hash,
        pin_salt: salt,
        pin_iter: iterations,
      });

      const currentSession = this.getSession();
      if (currentSession && currentSession.user.id === user.id) {
        this.saveSession(updated);
      }
    } else {
      // Validação de Senha (gerente ou admin)
      if (cleanNova.length < 8) {
        throw new Error('A nova senha deve conter no mínimo 8 caracteres.');
      }

      const isValidAtual = await verifySecretPBKDF2(
        cleanAtual,
        user.senha_hash,
        user.senha_salt,
        user.senha_iter || MIN_PBKDF2_ITERATIONS
      );

      if (!isValidAtual) {
        throw new Error('A senha atual informada está incorreta.');
      }

      const { hash, salt, iterations } = await hashSecretPBKDF2(cleanNova);

      const updated = await usuarioRepository.update(user.id, {
        senha_hash: hash,
        senha_salt: salt,
        senha_iter: iterations,
      });

      const currentSession = this.getSession();
      if (currentSession && currentSession.user.id === user.id) {
        this.saveSession(updated);
      }
    }
  }

  // =========================================================================
  // GESTÃO DE USUÁRIOS (ADMINISTRAÇÃO)
  // =========================================================================

  async getUsuarios(): Promise<Usuario[]> {
    return usuarioRepository.getAll();
  }

  async getUsuarioById(id: string): Promise<Usuario | null> {
    return usuarioRepository.getById(id);
  }

  async criarUsuario(dados: CriarUsuarioDTO): Promise<Usuario> {
    if (!dados.nome.trim()) {
      throw new Error('O nome do usuário é obrigatório.');
    }

    if (dados.perfil === 'operador' || dados.perfil === 'lider') {
      const mat = (dados.matricula || '').trim().toUpperCase();
      const pin = (dados.pin || '').trim();

      if (!mat) throw new Error('A matrícula é obrigatória para operador/líder.');
      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        throw new Error('O PIN deve conter entre 4 e 6 dígitos numéricos.');
      }

      const existing = await usuarioRepository.getByMatricula(mat);
      if (existing) {
        throw new Error(`A matrícula "${mat}" já está em uso por outro usuário.`);
      }

      const { hash, salt, iterations } = await hashSecretPBKDF2(pin);

      return usuarioRepository.create({
        empresa_id: DEFAULT_EMPRESA_ID,
        nome: dados.nome.trim(),
        perfil: dados.perfil,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
        operador_id: dados.operador_id || undefined,
        matricula: mat,
        pin_hash: hash,
        pin_salt: salt,
        pin_iter: iterations,
        criado_em: new Date().toISOString(),
      });
    } else {
      // Gerente ou Admin
      const email = (dados.email || '').trim().toLowerCase();
      const senha = (dados.senha || '').trim();

      if (!email || !email.includes('@')) {
        throw new Error('Informe um endereço de e-mail corporativo válido.');
      }
      if (!senha || senha.length < 8) {
        throw new Error('A senha deve conter no mínimo 8 caracteres.');
      }

      const existing = await usuarioRepository.getByEmail(email);
      if (existing) {
        throw new Error(`O e-mail "${email}" já está em uso.`);
      }

      const { hash, salt, iterations } = await hashSecretPBKDF2(senha);

      return usuarioRepository.create({
        empresa_id: DEFAULT_EMPRESA_ID,
        nome: dados.nome.trim(),
        perfil: dados.perfil,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
        email,
        senha_hash: hash,
        senha_salt: salt,
        senha_iter: iterations,
        criado_em: new Date().toISOString(),
      });
    }
  }

  async atualizarUsuario(id: string, dados: AtualizarUsuarioDTO): Promise<Usuario> {
    const user = await usuarioRepository.getById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    // Proteção rigorosa do último administrador ativo
    if (user.perfil === 'admin') {
      const allUsers = await usuarioRepository.getAll();
      const activeAdmins = allUsers.filter((u) => u.perfil === 'admin' && u.ativo);

      // Bloqueia rebaixamento de perfil se for o último admin
      if (dados.perfil && dados.perfil !== 'admin' && activeAdmins.length <= 1) {
        throw new Error('Não é permitido alterar o perfil do único administrador ativo do sistema.');
      }

      // Bloqueia desativação se for o último admin ativo
      if (dados.ativo === false && activeAdmins.length <= 1) {
        throw new Error('Não é permitido desativar o único administrador ativo do sistema.');
      }
    }

    const updates: Partial<Usuario> = {};

    if (dados.nome !== undefined) updates.nome = dados.nome.trim();
    if (dados.perfil !== undefined) updates.perfil = dados.perfil;
    if (dados.operador_id !== undefined) updates.operador_id = dados.operador_id || undefined;
    if (dados.ativo !== undefined) updates.ativo = dados.ativo;

    if (dados.matricula !== undefined) {
      const mat = dados.matricula.trim().toUpperCase();
      const existing = await usuarioRepository.getByMatricula(mat);
      if (existing && existing.id !== id) {
        throw new Error(`A matrícula "${mat}" já está cadastrada para outro usuário.`);
      }
      updates.matricula = mat;
    }

    if (dados.email !== undefined) {
      const email = dados.email.trim().toLowerCase();
      const existing = await usuarioRepository.getByEmail(email);
      if (existing && existing.id !== id) {
        throw new Error(`O e-mail "${email}" já está cadastrado para outro usuário.`);
      }
      updates.email = email;
    }

    const updated = await usuarioRepository.update(id, updates);

    // Se o usuário atualizou a si mesmo, sincroniza a sessão
    const currentSession = this.getSession();
    if (currentSession && currentSession.user.id === id) {
      this.saveSession(updated);
    }

    return updated;
  }

  /**
   * Redefine a credencial de um usuário (apenas administrador)
   */
  async redefinirCredencial(id: string, novaSenhaOuPin: string): Promise<void> {
    const user = await usuarioRepository.getById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    const clean = (novaSenhaOuPin || '').trim();

    if (user.perfil === 'operador' || user.perfil === 'lider') {
      if (!clean || clean.length < 4 || clean.length > 6 || !/^\d+$/.test(clean)) {
        throw new Error('O PIN deve conter entre 4 e 6 dígitos numéricos.');
      }
      const { hash, salt, iterations } = await hashSecretPBKDF2(clean);
      await usuarioRepository.update(id, {
        pin_hash: hash,
        pin_salt: salt,
        pin_iter: iterations,
      });
    } else {
      if (!clean || clean.length < 8) {
        throw new Error('A senha deve conter no mínimo 8 caracteres.');
      }
      const { hash, salt, iterations } = await hashSecretPBKDF2(clean);
      await usuarioRepository.update(id, {
        senha_hash: hash,
        senha_salt: salt,
        senha_iter: iterations,
      });
    }
  }

  async alternarStatusUsuario(id: string): Promise<Usuario> {
    const user = await usuarioRepository.getById(id);
    if (!user) throw new Error('Usuário não encontrado.');

    // Previne desativar o usuário se for o único admin ativo
    if (user.perfil === 'admin' && user.ativo) {
      const allUsers = await usuarioRepository.getAll();
      const activeAdmins = allUsers.filter((u) => u.perfil === 'admin' && u.ativo);
      if (activeAdmins.length <= 1) {
        throw new Error('Não é permitido desativar o único administrador ativo do sistema.');
      }
    }

    const updated = await usuarioRepository.update(id, {
      ativo: !user.ativo,
    });

    return updated;
  }

  async excluirUsuario(id: string): Promise<void> {
    const user = await usuarioRepository.getById(id);
    if (!user) return;

    if (user.perfil === 'admin') {
      const allUsers = await usuarioRepository.getAll();
      const admins = allUsers.filter((u) => u.perfil === 'admin' && u.ativo);
      if (admins.length <= 1) {
        throw new Error('Não é possível excluir o único administrador ativo do sistema.');
      }
    }

    await usuarioRepository.delete(id);
  }
}

export const authService = new AuthService();
