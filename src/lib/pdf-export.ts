import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './expense-validation';

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
  rendimentoTotalParametrizado: number;
  rendimentoTotalUtilizado: number;
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

export async function generatePDFReport(data: ReportData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(59, 130, 246); // primary blue
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RE-Reports', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Extrato de Remuneração Estratégica', 14, 26);

  doc.setFontSize(12);
  doc.text(`Período: ${data.periodo}`, pageWidth - 14, 18, { align: 'right' });
  // Usar data local corretamente para evitar problema de timezone
  const hoje = new Date();
  const dia = hoje.getDate();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  doc.text(`Gerado em: ${dataFormatada}`, pageWidth - 14, 26, { align: 'right' });

  // Employee info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Colaborador', 14, 48);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${data.colaborador.nome}`, 14, 56);
  doc.text(`Matrícula: ${data.colaborador.matricula}`, 14, 62);
  doc.text(`Departamento: ${data.colaborador.departamento}`, 100, 56);
  doc.text(`E-mail: ${data.colaborador.email}`, 100, 62);

  // Summary Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo da Remuneração', 14, 78);

  autoTable(doc, {
    startY: 82,
    head: [['Componente', 'Parametrizado', 'Utilizado', '%']],
    body: [
      ...data.resumo.map(item => [
        item.componente,
        formatCurrency(item.valorParametrizado),
        formatCurrency(item.valorUtilizado),
        item.percentual > 0 ? `${Math.round(item.percentual)}%` : '-'
      ]),
      [
        { content: 'RENDIMENTO TOTAL', styles: { fontStyle: 'bold', fillColor: [239, 246, 255] } },
        { content: formatCurrency(isNaN(data.rendimentoTotalParametrizado) ? 0 : data.rendimentoTotalParametrizado), styles: { fontStyle: 'bold', fillColor: [239, 246, 255] } },
        { content: formatCurrency(isNaN(data.rendimentoTotalUtilizado) ? 0 : data.rendimentoTotalUtilizado), styles: { fontStyle: 'bold', fillColor: [239, 246, 255] } },
        { content: data.rendimentoTotalParametrizado > 0 ? `${Math.round((data.rendimentoTotalUtilizado / data.rendimentoTotalParametrizado) * 100)}%` : '-', styles: { fontStyle: 'bold', fillColor: [239, 246, 255] } }
      ]
    ],
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  });

  // Utilization section
  const tableEndY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Análise de Utilização - Cesta de Benefícios', 14, tableEndY);

  // Utilization boxes
  const boxY = tableEndY + 5;
  const boxWidth = (pageWidth - 42) / 4;
  const boxHeight = 20;

  // Box 1 - Limite
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, boxY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(data.utilizacao.limiteCesta), 14 + boxWidth / 2, boxY + 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Limite Total', 14 + boxWidth / 2, boxY + 16, { align: 'center' });

  // Box 2 - Utilizado
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(formatCurrency(data.utilizacao.totalUtilizado), 14 + boxWidth * 1.5 + 4, boxY + 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Utilizado', 14 + boxWidth * 1.5 + 4, boxY + 16, { align: 'center' });

  // Box 3 - Percentual
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14 + (boxWidth + 4) * 2, boxY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${data.utilizacao.percentual}%`, 14 + boxWidth * 2.5 + 8, boxY + 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Percentual', 14 + boxWidth * 2.5 + 8, boxY + 16, { align: 'center' });

  // Box 4 - PI/DA
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14 + (boxWidth + 4) * 3, boxY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(formatCurrency(data.utilizacao.diferencaPida), 14 + boxWidth * 3.5 + 12, boxY + 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Convertido PI/DA', 14 + boxWidth * 3.5 + 12, boxY + 16, { align: 'center' });

  // Progress bar
  const progressY = boxY + boxHeight + 5;
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(14, progressY, pageWidth - 28, 4, 2, 2, 'F');
  doc.setFillColor(59, 130, 246);
  const progressWidth = ((pageWidth - 28) * data.utilizacao.percentual) / 100;
  doc.roundedRect(14, progressY, progressWidth, 4, 2, 2, 'F');

  // Chart section - expenses by category
  if (data.totaisPorCategoria.length > 0) {
    const chartY = progressY + 20;

    if (chartY < doc.internal.pageSize.getHeight() - 60) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Distribuição por Categoria', 14, chartY);

      autoTable(doc, {
        startY: chartY + 4,
        head: [['Categoria', 'Valor', 'Representação']],
        body: data.totaisPorCategoria.map(item => {
          const total = data.totaisPorCategoria.reduce((acc, i) => acc + i.valor, 0);
          const percent = total > 0 ? Math.round((item.valor / total) * 100) : 0;
          return [item.categoria, formatCurrency(item.valor), `${percent}%`];
        }),
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 },
      });
    }
  }

  // Expense details on new page if needed
  if (data.despesas.length > 0) {
    doc.addPage();

    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento de Despesas', 14, 14);

    const originLabels: Record<string, string> = {
      proprio: 'Próprio',
      conjuge: 'Cônjuge',
      filhos: 'Filhos',
    };

    const statusLabels: Record<string, string> = {
      valido: 'Aprovado',
      invalido: 'Rejeitado',
      enviado: 'Enviado',
      em_analise: 'Em Análise',
    };

    autoTable(doc, {
      startY: 28,
      head: [['Data', 'Tipo de Despesa', 'Origem', 'Valor', 'Status']],
      body: data.despesas.map(item => [
        formatDate(item.data),
        item.tipo,
        originLabels[item.origem] || item.origem,
        formatCurrency(item.valor),
        statusLabels[item.status] || item.status
      ]),
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `RE-Reports - Documento gerado automaticamente - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}
