/**
 * Report Export Utility
 * Provides secure CSV serialization with formula-injection prevention and
 * multi-page PDF generation with IEM institutional branding and table pagination.
 */

/**
 * Sanitize cell values against CSV / Excel Formula Injection (CSV Injection / CWE-1236).
 * Any cell beginning with '=', '+', '-', '@', '\t', '\r' is prepended with a single quote.
 */
function sanitizeCsvValue(val) {
  if (val == null) return '';
  if (val instanceof Date) {
    return val.toISOString().replace('T', ' ').substring(0, 19);
  }
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV string from headers and rows
 */
function generateCsv({ headers, rows }) {
  const headerLine = headers.map(sanitizeCsvValue).join(',');
  const rowLines = rows.map((r) => r.map(sanitizeCsvValue).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Escape literal strings for standard PDF PostScript string syntax
 */
function escapePdfString(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Truncate string to max length to fit column width
 */
function truncateText(text, maxChars = 24) {
  const str = String(text ?? '').trim();
  if (str.length <= maxChars) return str;
  return str.substring(0, maxChars - 2) + '..';
}

/**
 * Multi-page PDF Generator with IEM institutional styling, KPI metrics and paginated tables
 */
function generatePdf({
  title = 'Administrative Report',
  subtitle = 'IEM Online Admission Management System',
  session = 'All Sessions',
  generatedBy = 'Administrator',
  filters = {},
  kpis = [],
  headers = [],
  rows = [],
  colWidths = []
}) {
  const objects = [];
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  // 1: Catalog
  addObject(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2: Pages container (forward ref, updated at end)
  const pagesObjIndex = 2;
  objects.push('');

  // Fonts
  const fontNormalIndex = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  const fontBoldIndex = addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);

  // Page Dimensions (A4 Portrait)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginLeft = 36;
  const marginRight = 36;
  const contentWidth = pageWidth - marginLeft - marginRight; // 523.28

  // Calculate Column Widths
  const numCols = headers.length || 1;
  let computedColWidths = [];
  if (colWidths && colWidths.length === numCols) {
    const sumSpecified = colWidths.reduce((a, b) => a + b, 0);
    computedColWidths = colWidths.map((w) => (w / sumSpecified) * contentWidth);
  } else {
    computedColWidths = Array(numCols).fill(contentWidth / numCols);
  }

  // Row heights and paging calculations
  const rowHeight = 18;
  const maxTableHeightFirstPage = 480;
  const maxTableHeightSubsequent = 680;

  const rowsPerPageFirst = Math.floor(maxTableHeightFirstPage / rowHeight);
  const rowsPerPageSubsequent = Math.floor(maxTableHeightSubsequent / rowHeight);

  // Split rows across pages
  const pageRowBatches = [];
  if (rows.length === 0) {
    pageRowBatches.push([]);
  } else {
    let remainingRows = [...rows];
    pageRowBatches.push(remainingRows.splice(0, rowsPerPageFirst));
    while (remainingRows.length > 0) {
      pageRowBatches.push(remainingRows.splice(0, rowsPerPageSubsequent));
    }
  }

  const totalPages = pageRowBatches.length;
  const pageObjectIndices = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageRows = pageRowBatches[pageNum - 1];
    let stream = '';

    if (pageNum === 1) {
      // PAGE 1 HEADER
      // Institutional Brand Header
      stream += `0.0 0.17 0.29 rg\n`; // IEM Deep Blue #002b49
      stream += `${marginLeft} 760 ${contentWidth} 50 re f\n`;
      stream += `1 1 1 rg\n`;
      stream += `BT /F2 15 Tf ${marginLeft + 14} 788 Td (INSTITUTE OF ENGINEERING & MANAGEMENT) Tj ET\n`;
      stream += `BT /F1 9.5 Tf ${marginLeft + 14} 772 Td (${escapePdfString(subtitle)}) Tj ET\n`;

      // Title & Generation Metadata
      stream += `0 0 0 rg\n`;
      stream += `BT /F2 14 Tf ${marginLeft} 734 Td (${escapePdfString(title)}) Tj ET\n`;

      const filterSummary = Object.entries(filters || {})
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ') || 'None';

      stream += `0.35 0.35 0.35 rg\n`;
      stream += `BT /F1 8.5 Tf ${marginLeft} 718 Td (Session: ${escapePdfString(session)} | Filter: ${escapePdfString(filterSummary)} | Generated: ${new Date().toISOString().substring(0, 10)}) Tj ET\n`;

      // Separator line
      stream += `0.8 0.8 0.8 RG 1 w ${marginLeft} 708 m ${marginLeft + contentWidth} 708 l S\n`;

      // KPI Summary Ribbon (if present)
      let currentY = 698;
      if (kpis && kpis.length > 0) {
        const kpiCount = Math.min(kpis.length, 4);
        const kpiBoxWidth = (contentWidth - (kpiCount - 1) * 8) / kpiCount;
        for (let i = 0; i < kpiCount; i++) {
          const kpi = kpis[i];
          const kpiX = marginLeft + i * (kpiBoxWidth + 8);
          // KPI Box Background
          stream += `0.96 0.97 0.98 rg ${kpiX} ${currentY - 36} ${kpiBoxWidth} 36 re f\n`;
          stream += `0.85 0.88 0.91 RG 0.5 w ${kpiX} ${currentY - 36} ${kpiBoxWidth} 36 re S\n`;
          // Label
          stream += `0.4 0.45 0.5 rg\n`;
          stream += `BT /F1 7.5 Tf ${kpiX + 6} ${currentY - 12} Td (${escapePdfString(kpi.label)}) Tj ET\n`;
          // Value
          stream += `0.0 0.17 0.29 rg\n`;
          stream += `BT /F2 12 Tf ${kpiX + 6} ${currentY - 28} Td (${escapePdfString(String(kpi.value))}) Tj ET\n`;
        }
        currentY -= 48;
      } else {
        currentY -= 10;
      }

      // Draw Table on Page 1
      drawTable(currentY, pageRows);
    } else {
      // SUBSEQUENT PAGES HEADER
      stream += `0.0 0.17 0.29 rg\n`;
      stream += `BT /F2 10 Tf ${marginLeft} 805 Td (IEM Admission Management System — ${escapePdfString(title)}) Tj ET\n`;
      stream += `0.7 0.7 0.7 RG 0.5 w ${marginLeft} 795 m ${marginLeft + contentWidth} 795 l S\n`;

      // Draw Table on Subsequent Page
      drawTable(780, pageRows);
    }

    // Common Footer on every page
    stream += `0.5 0.5 0.5 rg\n`;
    stream += `BT /F1 8 Tf ${marginLeft} 26 Td (Confidential — Official Record of Institute of Engineering & Management) Tj ET\n`;
    stream += `BT /F1 8 Tf ${marginLeft + contentWidth - 65} 26 Td (Page ${pageNum} of ${totalPages}) Tj ET\n`;

    function drawTable(startY, rowData) {
      let y = startY;

      // Table Header Row
      stream += `0.0 0.17 0.29 rg ${marginLeft} ${y - 15} ${contentWidth} 20 re f\n`;
      stream += `1 1 1 rg\n`;

      let curX = marginLeft;
      for (let i = 0; i < headers.length; i++) {
        const text = truncateText(headers[i], Math.floor(computedColWidths[i] / 5.5));
        stream += `BT /F2 8 Tf ${curX + 4} ${y - 1} Td (${escapePdfString(text)}) Tj ET\n`;
        curX += computedColWidths[i];
      }

      y -= 18;

      // Data Rows
      if (rowData.length === 0) {
        stream += `0.4 0.4 0.4 rg\n`;
        stream += `BT /F1 9 Tf ${marginLeft + 180} ${y - 20} Td (No records found matching criteria.) Tj ET\n`;
        return;
      }

      for (let rIdx = 0; rIdx < rowData.length; rIdx++) {
        const row = rowData[rIdx];
        // Alternating row background
        if (rIdx % 2 === 1) {
          stream += `0.97 0.98 0.99 rg ${marginLeft} ${y - 12} ${contentWidth} ${rowHeight} re f\n`;
        }

        stream += `0.15 0.15 0.15 rg\n`;
        let cellX = marginLeft;
        for (let cIdx = 0; cIdx < headers.length; cIdx++) {
          const val = row[cIdx];
          const text = truncateText(val, Math.floor(computedColWidths[cIdx] / 5));
          stream += `BT /F1 8 Tf ${cellX + 4} ${y} Td (${escapePdfString(text)}) Tj ET\n`;
          cellX += computedColWidths[cIdx];
        }

        // Horizontal bottom gridline
        stream += `0.9 0.92 0.94 RG 0.5 w ${marginLeft} ${y - 12} m ${marginLeft + contentWidth} ${y - 12} l S\n`;
        y -= rowHeight;
      }
    }

    const contentStreamObjIndex = addObject(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );

    const pageObjIndex = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontNormalIndex} 0 R /F2 ${fontBoldIndex} 0 R >> >> /Contents ${contentStreamObjIndex} 0 R >>`
    );

    pageObjectIndices.push(pageObjIndex);
  }

  // Update Pages Object (2)
  const kidsList = pageObjectIndices.map((idx) => `${idx} 0 R`).join(' ');
  objects[pagesObjIndex - 1] = `<< /Type /Pages /Kids [${kidsList}] /Count ${totalPages} >>`;

  // Assemble Binary PDF Output
  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const xrefOffsets = [0];

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

module.exports = {
  sanitizeCsvValue,
  generateCsv,
  generatePdf
};
