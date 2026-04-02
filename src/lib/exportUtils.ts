import { sanitizeExportRow } from '@/lib/security';

/**
 * Export data to CSV (lazy-loads papaparse on demand)
 */
export const exportToCSV = async (data: any[], fileName: string) => {
    const Papa = (await import('papaparse')).default;
    const sanitizedData = data.map(row => sanitizeExportRow(row));
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * Export data to Excel (lazy-loads xlsx on demand)
 */
export const exportToExcel = async (data: any[], fileName: string) => {
    const XLSX = await import('xlsx');
    const sanitizedData = data.map(row => sanitizeExportRow(row));
    const worksheet = XLSX.utils.json_to_sheet(sanitizedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Export data to PDF (lazy-loads jspdf + autotable on demand)
 */
export const exportToPDF = async (
    data: any[],
    columns: string[],
    fileName: string,
    title: string
) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // Add timestamp
    const timestamp = new Date().toLocaleString();
    doc.text(`Generated on: ${timestamp}`, 14, 30);

    // Generate table (sanitize for formula injection)
    const sanitizedData = data.map(row => sanitizeExportRow(row));
    const tableData = sanitizedData.map(item => columns.map(col => item[col] || ''));

    autoTable(doc, {
        startY: 35,
        head: [columns.map(col => col.replace(/_/g, ' ').toUpperCase())],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }, // primary blue
    });

    doc.save(`${fileName}.pdf`);
};
