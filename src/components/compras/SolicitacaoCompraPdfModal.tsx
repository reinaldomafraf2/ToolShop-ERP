import React from 'react';
import { ItemCompraComDetalhes, ConfiguracoesSistema, Fornecedor } from '../../types';
import { formatDateBR } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Printer, Download, X, FileText } from 'lucide-react';

interface SolicitacaoCompraPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  itens: ItemCompraComDetalhes[];
  fornecedorFiltro?: Fornecedor | null;
  configEmpresa?: ConfiguracoesSistema | null;
  titulo?: string;
}

export const SolicitacaoCompraPdfModal: React.FC<SolicitacaoCompraPdfModalProps> = ({
  isOpen,
  onClose,
  itens,
  fornecedorFiltro,
  configEmpresa,
  titulo = 'SOLICITAÇÃO DE COMPRA DE MATERIAIS',
}) => {
  if (!isOpen) return null;

  const dataEmissao = formatDateBR(new Date().toISOString());
  const empresaNome = configEmpresa?.empresa_nome || 'TOOLSHOP FERRAMENTARIA & USINAGEM LTDA';
  const empresaCnpj = configEmpresa?.empresa_cnpj || '12.345.678/0001-90';
  const empresaEndereco =
    configEmpresa?.empresa_endereco ||
    'Rua das Indústrias, 1000 - Distrito Industrial - Joinville/SC';
  const empresaTelefone = configEmpresa?.empresa_telefone || '(47) 3456-7890';
  const empresaLogo = configEmpresa?.empresa_logo;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pré-visualização: Solicitação de Compra (PDF)"
      subtitle="Documento pronto para impressão em A4 preto e branco (sem valores financeiros)"
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Barra superior de ações */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
          <div className="text-xs text-slate-600">
            Total de itens na solicitação: <strong>{itens.length}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Solicitação</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* ÁREA DE IMPRESSÃO A4 (PRETO E BRANCO) */}
        <div className="border border-black p-6 bg-white text-black font-sans print:p-0 print:border-none">
          {/* 1. Cabeçalho da Empresa */}
          <div className="border-2 border-black p-3 mb-4">
            <div className="flex items-start justify-between gap-4 border-b border-black pb-3">
              <div className="flex items-center gap-3">
                {empresaLogo ? (
                  <img
                    src={empresaLogo}
                    alt="Logo Empresa"
                    className="h-12 w-auto max-w-[140px] object-contain grayscale"
                  />
                ) : (
                  <div className="border border-black px-2 py-1 font-mono font-bold text-xs uppercase tracking-wider">
                    TOOLSHOP
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-bold tracking-tight uppercase leading-snug">
                    {empresaNome}
                  </h1>
                  <p className="text-[10px] text-black">
                    CNPJ: {empresaCnpj} · Tel: {empresaTelefone}
                  </p>
                  <p className="text-[10px] text-black">{empresaEndereco}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="block border border-black bg-black text-white px-2 py-0.5 font-mono text-xs font-bold uppercase">
                  {titulo}
                </span>
                <span className="block text-[11px] font-mono mt-1">Data: {dataEmissao}</span>
              </div>
            </div>

            {/* Dados do Fornecedor / Destinatário se selecionado */}
            {fornecedorFiltro && (
              <div className="mt-2.5 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase">Fornecedor:</span>
                  <strong className="text-xs">{fornecedorFiltro.nome}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase">Contato:</span>
                  <span>{fornecedorFiltro.contato || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase">Telefone:</span>
                  <span className="font-mono">{fornecedorFiltro.telefone || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase">E-mail:</span>
                  <span>{fornecedorFiltro.email || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Tabela de Itens (Sem Valores) */}
          <div className="overflow-hidden border border-black">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-black bg-slate-100 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2 border-r border-black w-24">Código</th>
                  <th className="py-2 px-2 border-r border-black">Descrição</th>
                  <th className="py-2 px-2 border-r border-black">Especificação (Material / Bruto)</th>
                  <th className="py-2 px-2 border-r border-black w-14 text-center">Qtd</th>
                  <th className="py-2 px-2 border-r border-black w-12 text-center">Un</th>
                  <th className="py-2 px-2 border-r border-black w-28">Fornecedor</th>
                  <th className="py-2 px-2 border-r border-black w-20 text-center">Lista</th>
                  <th className="py-2 px-2 w-32">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {itens.map((item, idx) => (
                  <tr key={item.id || idx} className="border-t border-black">
                    <td className="py-2 px-2 border-r border-black font-mono font-bold align-top">
                      {item.componente?.codigo || item.projeto?.codigo || '—'}
                    </td>
                    <td className="py-2 px-2 border-r border-black font-semibold align-top">
                      {item.descricao}
                      {item.projeto && (
                        <span className="block text-[10px] font-normal text-slate-600">
                          Projeto: {item.projeto.codigo}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 border-r border-black font-mono text-[11px] align-top">
                      {item.especificacao || '—'}
                    </td>
                    <td className="py-2 px-2 border-r border-black font-mono font-bold text-center align-top">
                      {item.quantidade}
                    </td>
                    <td className="py-2 px-2 border-r border-black text-center uppercase font-mono align-top">
                      {item.unidade}
                    </td>
                    <td className="py-2 px-2 border-r border-black align-top text-[11px]">
                      {item.fornecedor?.nome || '—'}
                    </td>
                    <td className="py-2 px-2 border-r border-black text-center font-mono align-top text-[11px]">
                      {item.numero_lista || '—'}
                    </td>
                    <td className="py-2 px-2 text-[10px] text-slate-700 align-top">
                      {item.observacoes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Rodapé Técnico de Aprovação */}
          <div className="mt-6 border-t-2 border-black pt-4 grid grid-cols-2 gap-8 text-xs">
            <div>
              <div className="border-b border-black pb-1 mb-1 font-semibold uppercase text-[10px]">
                Solicitado por:
              </div>
              <div className="h-8"></div>
              <p className="text-[10px] text-slate-600">Assinatura / Data</p>
            </div>
            <div>
              <div className="border-b border-black pb-1 mb-1 font-semibold uppercase text-[10px]">
                Aprovação da Chefia / Compras:
              </div>
              <div className="h-8"></div>
              <p className="text-[10px] text-slate-600">Visto / Data</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
