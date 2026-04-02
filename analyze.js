const XLSX = require('xlsx');
const wb = XLSX.readFile('DAP_Import_Ready.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

let issues = [];

data.forEach((row, i) => {
    const rowNum = i + 2;
    const status = (row['Case Status'] || '').toString().trim();
    const client = (row['Case Uploaded To'] || '').toString().trim();
    const approved = (row['Case Approved'] || '').toString().trim().toLowerCase();
    const rejected = (row['Case Rejected'] || '').toString().trim().toLowerCase();
    const uploadDate = (row['Case Upload Date'] || '').toString().trim();
    const approvedDate = (row['Case Approved Date'] || '').toString().trim();
    const indepthDate = (row['InDepth Due Date'] || '').toString().trim();
    const enfDate = (row['Enforcement Due Date'] || '').toString().trim();
    const invIssue = (row['Invoice Issue Date'] || '').toString().trim();
    const invDue = (row['Invoice Due Date'] || '').toString().trim();
    const invStatus = (row['Invoice Status'] || '').toString().trim();
    const destDate = (row['Destruction Due Date'] || '').toString().trim();
    const fee = row['Our Fee USD'];

    const upperStatus = ['IN_DEPTH','ENFORCEMENT','FINAL_REPORT','INVOICED','CLOSED'];

    if (status === 'UPLOADED' && !client) issues.push('Row ' + rowNum + ': UPLOADED but no Client');
    if (upperStatus.includes(status)) {
        if (approved !== 'yes') issues.push('Row ' + rowNum + ' [' + status + ']: missing Case Approved=Yes (got: "' + approved + '")');
        if (!approvedDate) issues.push('Row ' + rowNum + ' [' + status + ']: missing Case Approved Date');
    }
    if (['IN_DEPTH','ENFORCEMENT','FINAL_REPORT','INVOICED','CLOSED'].includes(status) && !indepthDate) {
        issues.push('Row ' + rowNum + ' [' + status + ']: missing InDepth Due Date');
    }
    if (['ENFORCEMENT','FINAL_REPORT','INVOICED','CLOSED'].includes(status) && !enfDate) {
        issues.push('Row ' + rowNum + ' [' + status + ']: missing Enforcement Due Date');
    }
    if (['INVOICED','CLOSED'].includes(status)) {
        if (!invIssue && !invDue) issues.push('Row ' + rowNum + ' [' + status + ']: missing Invoice dates');
        if (!fee) issues.push('Row ' + rowNum + ' [' + status + ']: missing Our Fee USD');
    }
    if (status === 'CLOSED' && invStatus && invStatus.toLowerCase() !== 'paid') {
        issues.push('Row ' + rowNum + ' [CLOSED]: Invoice Status is "' + invStatus + '" not Paid');
    }
    if (status === 'IN_HAND' && (client || uploadDate)) {
        issues.push('Row ' + rowNum + ' [IN_HAND]: has upload data but status is IN_HAND');
    }
    if (['FINAL_REPORT','INVOICED','CLOSED'].includes(status) && !destDate) {
        issues.push('Row ' + rowNum + ' [' + status + ']: missing Destruction Due Date');
    }
    if (status === 'REJECTED' && (indepthDate || enfDate)) {
        issues.push('Row ' + rowNum + ' [REJECTED]: should not have In-Depth or Enforcement data');
    }

    console.log('Row ' + rowNum + ': [' + status + '] ' + row['Brand Name'] + ' | Client: ' + client + ' | Approved: ' + approved + ' | InDepthDate: ' + indepthDate + ' | EnfDate: ' + enfDate + ' | InvStatus: ' + invStatus + ' | DestDate: ' + destDate + ' | Fee: ' + fee);
});

console.log('');
console.log('=== ISSUES FOUND: ' + issues.length + ' ===');
issues.forEach(function(i) { console.log('  * ' + i); });
