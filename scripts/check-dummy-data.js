import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'DAP_Dummy_Data_v2.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = jsonData[0];
    const firstDataRow = jsonData[1];

    const colIndex = headers.findIndex(h => String(h).toLowerCase().includes('uploaded to'));
    if (colIndex !== -1) {
        console.log(`HEADER: "${headers[colIndex]}" | VALUE: "${firstDataRow[colIndex]}"`);
    } else {
        console.log('Column "Uploaded To" not found in headers:', headers);
    }

} catch (err) {
    console.error('Error reading file:', err.message);
}
