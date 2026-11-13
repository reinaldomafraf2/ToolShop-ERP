import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { UnidadeEstoqueComDetalhes } from '../../types';
import { Modal } from '../common/Modal';
import { Printer, QrCode, Tag, X, Check } from 'lucide-react';
import { formatDateBR } from '../../utils/formatters';

interface EtiquetaPecaPdfModalProps {
  unidade: UnidadeEstoqueComDetalhes | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EtiquetaPecaPdfModal: React.FC<EtiquetaPecaPdfModalProps> = ({
  unidade,
  isOpen,
  onClose,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unidade && isOpen) {
      // Gera QR code com id da unidade ou link identificador
      const qrPayload = JSON.stringify({
        id: unidade.id,
        etiqueta: unidade.etiqueta,
        item: unidade.item?.codigo,
        dim: `${unidade.comprimento_mm || 0}x${unidade.largura_mm || 0}x${unidade.espessura_mm || 0}`,
      });

      QRCode.toDataURL(qrPayload, {
        width: 160,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Erro ao gerar QR Code da etiqueta:', err));
    }
  }, [unidade, isOpen]);

  const handlePrint = () => {
    window.print();
  };

  if (!unidade) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Etiqueta de Identificação Física"
      subtitle={`Etiqueta de rastreabilidade para almoxarifado e oficina: ${unidade.etiqueta}`}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Visualizador da Etiqueta para Impressão */}
        <div className="flex justify-center p-2">
          <div
            ref={printRef}
            id="area-impressao-etiqueta"
            className="w-full max-w-sm rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-md print:m-0 print:border-2 print:shadow-none print:w-[80mm] print:h-[60mm]"
          >
            {/* Cabeçalho da Etiqueta */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  ToolShop ERP · Rastreabilidade
                </span>
                <span className="font-mono text-xl font-extrabold tracking-tight text-slate-900">
                  {unidade.etiqueta}
                </span>
              </div>
              <div className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase font-mono">
                {unidade.origem === 'sobra' ? 'RETALHO' : 'PEÇA'}
              </div>
            </div>

            {/* Conteúdo Principal + QR Code */}
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="space-y-1.5 text-xs text-slate-800 flex-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Material / Especificação
                  </span>
                  <span className="font-bold text-slate-900 truncate block">
                    {unidade.material || unidade.item?.especificacao || 'Aço Ferramenta'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Dimensões Físicas (mm)
                  </span>
                  <span className="font-mono font-extrabold text-sm text-slate-900 block">
                    {unidade.diametro_mm && unidade.diametro_mm > 0
                      ? `Ø ${unidade.diametro_mm} × ${unidade.comprimento_mm || 0} mm`
                      : `${unidade.comprimento_mm || 0} × ${unidade.largura_mm || 0} × ${
                          unidade.espessura_mm || 0
                        } mm`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Peso</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                      {unidade.peso_kg ? `${unidade.peso_kg.toFixed(2)} kg` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Local</span>
                    <span className="font-bold text-slate-800 text-[11px] truncate block">
                      {unidade.localizacao || 'Almoxarifado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 flex flex-col items-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={`QR Code ${unidade.etiqueta}`}
                    className="h-24 w-24 rounded border border-slate-200"
                  />
                ) : (
                  <div className="h-24 w-24 bg-slate-100 flex items-center justify-center rounded border border-slate-200">
                    <QrCode className="h-8 w-8 text-slate-400" />
                  </div>
                )}
                <span className="text-[8px] font-mono text-slate-400 mt-1">ID Rastreio</span>
              </div>
            </div>

            {/* Rodapé da Etiqueta */}
            <div className="mt-3 border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Item: {unidade.item?.codigo || 'ESTOQUE'}</span>
              <span>Emissão: {formatDateBR(new Date().toISOString().split('T')[0])}</span>
            </div>
          </div>
        </div>

        {/* Instruções e Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Dica: imprima em etiqueta adesiva térmica ou papel comum para fixar diretamente na barra/bloco.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
