// Utilitário para gerar arquivo ZIP com múltiplos PDFs
import { generatePDFReport } from './pdf-export';

interface ReportData {
  colaborador: {
    nome: string;
    matricula: string;
    departamento: string;
    email: string;
  };
  periodo: string;
  resumo: {
    componente: string;
    valorParametrizado: number;
    valorUtilizado: number;
    percentual: number;
  }[];
  rendimentoTotal: number;
  utilizacao: {
    limiteCesta: number;
    totalUtilizado: number;
    percentual: number;
    diferencaPida: number;
  };
  despesas: {
    tipo: string;
    origem: string;
    valor: number;
    status: string;
    data: Date;
  }[];
  totaisPorCategoria: { categoria: string; valor: number }[];
}

// Simple ZIP file creator without external dependencies
// Uses basic ZIP format structure
export async function generateZipWithPDFs(
  reports: ReportData[],
  periodo: string,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const files: { name: string; data: Uint8Array }[] = [];
  
  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    onProgress?.(i + 1, reports.length);
    
    try {
      const pdfBlob = await generatePDFReport(report);
      const pdfBuffer = await pdfBlob.arrayBuffer();
      const fileName = `Extrato_${report.colaborador.matricula}_${report.colaborador.nome.replace(/\s/g, '_')}_${periodo.replace('/', '')}.pdf`;
      
      files.push({
        name: fileName,
        data: new Uint8Array(pdfBuffer),
      });
    } catch (error) {
      console.error(`Erro ao gerar PDF para ${report.colaborador.nome}:`, error);
    }
  }
  
  return createZipBlob(files);
}

function createZipBlob(files: { name: string; data: Uint8Array }[]): Blob {
  const localFileHeaders: Uint8Array[] = [];
  const centralDirectoryEntries: Uint8Array[] = [];
  let offset = 0;
  
  for (const file of files) {
    const fileNameBytes = new TextEncoder().encode(file.name);
    
    // Local file header
    const localHeader = new Uint8Array(30 + fileNameBytes.length + file.data.length);
    const localView = new DataView(localHeader.buffer);
    
    // Local file header signature
    localView.setUint32(0, 0x04034b50, true);
    // Version needed to extract
    localView.setUint16(4, 20, true);
    // General purpose bit flag
    localView.setUint16(6, 0, true);
    // Compression method (0 = stored)
    localView.setUint16(8, 0, true);
    // File modification time
    localView.setUint16(10, 0, true);
    // File modification date
    localView.setUint16(12, 0, true);
    // CRC-32
    localView.setUint32(14, crc32(file.data), true);
    // Compressed size
    localView.setUint32(18, file.data.length, true);
    // Uncompressed size
    localView.setUint32(22, file.data.length, true);
    // File name length
    localView.setUint16(26, fileNameBytes.length, true);
    // Extra field length
    localView.setUint16(28, 0, true);
    
    // File name
    localHeader.set(fileNameBytes, 30);
    // File data
    localHeader.set(file.data, 30 + fileNameBytes.length);
    
    localFileHeaders.push(localHeader);
    
    // Central directory entry
    const centralEntry = new Uint8Array(46 + fileNameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    
    // Central directory file header signature
    centralView.setUint32(0, 0x02014b50, true);
    // Version made by
    centralView.setUint16(4, 20, true);
    // Version needed to extract
    centralView.setUint16(6, 20, true);
    // General purpose bit flag
    centralView.setUint16(8, 0, true);
    // Compression method
    centralView.setUint16(10, 0, true);
    // File modification time
    centralView.setUint16(12, 0, true);
    // File modification date
    centralView.setUint16(14, 0, true);
    // CRC-32
    centralView.setUint32(16, crc32(file.data), true);
    // Compressed size
    centralView.setUint32(20, file.data.length, true);
    // Uncompressed size
    centralView.setUint32(24, file.data.length, true);
    // File name length
    centralView.setUint16(28, fileNameBytes.length, true);
    // Extra field length
    centralView.setUint16(30, 0, true);
    // File comment length
    centralView.setUint16(32, 0, true);
    // Disk number start
    centralView.setUint16(34, 0, true);
    // Internal file attributes
    centralView.setUint16(36, 0, true);
    // External file attributes
    centralView.setUint32(38, 0, true);
    // Relative offset of local header
    centralView.setUint32(42, offset, true);
    
    // File name
    centralEntry.set(fileNameBytes, 46);
    
    centralDirectoryEntries.push(centralEntry);
    
    offset += localHeader.length;
  }
  
  const centralDirectoryStart = offset;
  const centralDirectorySize = centralDirectoryEntries.reduce((acc, entry) => acc + entry.length, 0);
  
  // End of central directory record
  const endOfCentralDir = new Uint8Array(22);
  const endView = new DataView(endOfCentralDir.buffer);
  
  // End of central directory signature
  endView.setUint32(0, 0x06054b50, true);
  // Number of this disk
  endView.setUint16(4, 0, true);
  // Disk where central directory starts
  endView.setUint16(6, 0, true);
  // Number of central directory records on this disk
  endView.setUint16(8, files.length, true);
  // Total number of central directory records
  endView.setUint16(10, files.length, true);
  // Size of central directory
  endView.setUint32(12, centralDirectorySize, true);
  // Offset of start of central directory
  endView.setUint32(16, centralDirectoryStart, true);
  // Comment length
  endView.setUint16(20, 0, true);
  
  // Combine all parts
  const totalSize = offset + centralDirectorySize + 22;
  const zipData = new Uint8Array(totalSize);
  
  let pos = 0;
  for (const header of localFileHeaders) {
    zipData.set(header, pos);
    pos += header.length;
  }
  for (const entry of centralDirectoryEntries) {
    zipData.set(entry, pos);
    pos += entry.length;
  }
  zipData.set(endOfCentralDir, pos);
  
  return new Blob([zipData], { type: 'application/zip' });
}

// CRC-32 calculation
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}
