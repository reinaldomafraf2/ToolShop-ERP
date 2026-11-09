import {
  Cliente,
  CentroCusto,
  Maquina,
  Operador,
  Projeto,
  Componente,
  Operacao,
  Apontamento,
  Usuario,
  ModeloComponente,
  HistoricoImportacao,
  OrigemCentroCusto,
} from '../types';

export interface IBaseRepository<T extends { id: string; empresa_id: string }> {
  getAll(empresaId?: string): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: Omit<T, 'id' | 'empresa_id'> & { id?: string; empresa_id?: string }): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  saveAll(items: T[]): Promise<void>;
}

export interface IClienteRepository extends IBaseRepository<Cliente> {
  search(query: string, empresaId?: string): Promise<Cliente[]>;
}

export interface ICentroCustoRepository extends IBaseRepository<CentroCusto> {
  getByCategoria(categoria: string, empresaId?: string): Promise<CentroCusto[]>;
  getByOrigem(origem: OrigemCentroCusto, empresaId?: string): Promise<CentroCusto[]>;
  /** @deprecated use getByCategoria */
  getByTipo?(tipo: string, empresaId?: string): Promise<CentroCusto[]>;
}

export type IMaquinaRepository = ICentroCustoRepository;

export interface IOperadorRepository extends IBaseRepository<Operador> {
  search(query: string, empresaId?: string): Promise<Operador[]>;
}

export interface IProjetoRepository extends IBaseRepository<Projeto> {
  getByClienteId(clienteId: string, empresaId?: string): Promise<Projeto[]>;
  getByStatus(status: string, empresaId?: string): Promise<Projeto[]>;
}

export interface IComponenteRepository extends IBaseRepository<Componente> {
  getByProjetoId(projetoId: string, empresaId?: string): Promise<Componente[]>;
}

export interface IOperacaoRepository extends IBaseRepository<Operacao> {
  getByComponenteId(componenteId: string, empresaId?: string): Promise<Operacao[]>;
  getByCentroCustoId(centroCustoId: string, empresaId?: string): Promise<Operacao[]>;
  getByMaquinaId(maquinaId: string, empresaId?: string): Promise<Operacao[]>;
}

export interface IApontamentoRepository extends IBaseRepository<Apontamento> {
  getByOperacaoId(operacaoId: string, empresaId?: string): Promise<Apontamento[]>;
  getByOperadorId(operadorId: string, empresaId?: string): Promise<Apontamento[]>;
  getActive(empresaId?: string): Promise<Apontamento[]>;
}

export interface IUsuarioRepository extends IBaseRepository<Usuario> {
  getByEmail(email: string, empresaId?: string): Promise<Usuario | null>;
  getByMatricula(matricula: string, empresaId?: string): Promise<Usuario | null>;
  search(query: string, empresaId?: string): Promise<Usuario[]>;
}

export interface IModeloComponenteRepository extends IBaseRepository<ModeloComponente> {
  getByCodigo(codigo: string, empresaId?: string): Promise<ModeloComponente | null>;
  search(query: string, empresaId?: string): Promise<ModeloComponente[]>;
}

export interface IHistoricoImportacaoRepository extends IBaseRepository<HistoricoImportacao> {
  getRecentes(limite?: number, empresaId?: string): Promise<HistoricoImportacao[]>;
}

