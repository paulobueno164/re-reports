import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './expense-validation';

export interface SimulationData {
  colaborador: {
    nome: string;
    matricula: string;
    departamento: string;
    email: string;
  };
  componentes: {
    nome: string;
    valor: number;
    tipo: 'Fixo' | 'Teto Variável' | string;
  }[];
  rendimentoTotal: number;
}

export async function generateSimulationPDF(data: SimulationData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RE-Reports', 14, 18);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Simulação da Remuneração Estratégica', 14, 28);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDate(new Date())}`, pageWidth - 14, 18, { align: 'right' });

  // Employee info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Colaborador', 14, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${data.colaborador.nome}`, 14, 65);
  doc.text(`Matrícula: ${data.colaborador.matricula}`, 14, 72);
  doc.text(`Departamento: ${data.colaborador.departamento}`, 100, 65);
  doc.text(`E-mail: ${data.colaborador.email}`, 100, 72);

  // Simulation Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Composição da Remuneração Estratégica', 14, 90);

  const fixos = data.componentes.filter(c => c.tipo === 'Fixo');
  const variaveis = data.componentes.filter(c => c.tipo === 'Teto Variável');

  // Fixed components
  autoTable(doc, {
    startY: 95,
    head: [['Componente Fixo', 'Valor Contratado']],
    body: fixos.map(item => [
      item.nome,
      formatCurrency(item.valor),
    ]),
    headStyles: { fillColor: [34, 197, 94], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
  });

  const fixoTableEnd = (doc as any).lastAutoTable.finalY + 5;
  const totalFixo = fixos.reduce((acc, c) => acc + c.valor, 0);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Subtotal Fixo: ${formatCurrency(totalFixo)}`, pageWidth - 14, fixoTableEnd, { align: 'right' });

  // Variable components
  autoTable(doc, {
    startY: fixoTableEnd + 10,
    head: [['Componente Variável', 'Valor Teto']],
    body: variaveis.map(item => [
      item.nome,
      formatCurrency(item.valor),
    ]),
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
  });

  const variavelTableEnd = (doc as any).lastAutoTable.finalY + 5;
  const totalVariavel = variaveis.reduce((acc, c) => acc + c.valor, 0);
  
  doc.text(`Subtotal Variável: ${formatCurrency(totalVariavel)}`, pageWidth - 14, variavelTableEnd, { align: 'right' });

  // Total box
  const totalY = variavelTableEnd + 15;
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(14, totalY, pageWidth - 28, 30, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RENDIMENTO TOTAL', pageWidth / 2, totalY + 12, { align: 'center' });
  doc.setFontSize(20);
  doc.text(formatCurrency(data.rendimentoTotal), pageWidth / 2, totalY + 24, { align: 'center' });

  // Notes
  const notesY = totalY + 45;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Observações:', 14, notesY);
  doc.text('• Valores fixos são garantidos mensalmente.', 14, notesY + 7);
  doc.text('• Valores variáveis (Cesta de Benefícios) dependem da apresentação de comprovantes.', 14, notesY + 14);
  doc.text('• PI/DA não utilizado da Cesta de Benefícios é convertido automaticamente (tributável).', 14, notesY + 21);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'RE-Reports - Simulação da Remuneração Estratégica - Documento gerado automaticamente',
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc.output('blob');
}

export function exportSimulationToExcel(data: SimulationData): void {
  // Using xlsx library would be imported from excel-export
  // For now, we'll create a CSV-compatible format
  const rows: string[] = [];
  rows.push('Componente,Tipo,Valor');
  
  data.componentes.forEach(c => {
    rows.push(`"${c.nome}","${c.tipo}","${c.valor}"`);
  });
  
  rows.push(`"RENDIMENTO TOTAL","",${data.rendimentoTotal}`);
  
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Simulacao_${data.colaborador.matricula}_${data.colaborador.nome.replace(/\s/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
