/**
 * generate-dummy-data.cjs
 * Generates DAP_Import_Ready.xlsx with 50 rows of correctly structured dummy data
 * matching the real DAP workflow rules.
 *
 * Run: node generate-dummy-data.cjs
 */

const XLSX = require('xlsx');

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(dateStr, days) {
    // dateStr = 'DD/MM/YYYY'
    var parts = dateStr.split('/');
    var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    d.setDate(d.getDate() + days);
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Reference Data ─────────────────────────────────────────────────────────

var brands = [
    'Surf Excel', 'Ariel', 'Omo', 'Tide', 'Persil',
    'Head & Shoulders', 'Pantene', 'Dove', 'Sunsilk', 'Clear',
    'Colgate', 'Oral-B', 'Sensodyne', 'Pepsodent', 'Signal',
    'Pepsi', 'Coca-Cola', 'Nestle', 'Unilever', 'P&G',
    'Knorr', 'Shan Foods', 'National Foods', 'English Biscuit', 'Bisconni',
    'Levis', 'Puma', 'Nike', 'Adidas', 'Zara',
    'Calvin Klein', 'Tommy Hilfiger', 'American Eagle', 'Johnson & Johnson', 'Peek Freans',
];

var products = [
    'Washing Powder', 'Detergent Bar', 'Liquid Detergent',
    'Shampoo', 'Conditioner', 'Hair Oil',
    'Toothpaste', 'Toothbrush', 'Mouthwash',
    'Soft Drink', 'Juice', 'Water Bottle',
    'Spices Mix', 'Cooking Oil', 'Biscuits',
    'Jeans', 'T-Shirt', 'Shoes', 'Sneakers', 'Sports Shoes',
    'Perfume', 'Lotion', 'Soap',
];

var categories = ['Factory', 'Shop', 'Distributor', 'Warehouse', 'Market Stall'];

var targetNames = [
    'Pak General Store', 'Sultan Enterprises', 'National Distributors',
    'City Traders', 'Al-Hafiz & Co', 'Brothers Trading',
    'Metro Wholesale', 'Karachi Imports', 'Lahore Supplies',
    'Ahmed & Sons', 'Malik Enterprises', 'Raza Brothers',
    'Punjab Traders', 'Sindh Distributors', 'KPK Wholesale',
    'Green Valley Trading', 'Star Enterprises', 'Diamond Traders',
    'Royal Distributors', 'Crown Trading Co',
];

var streets = [
    'Shop 12, Main Bazaar', 'Plot 5, Industrial Area', 'House No. 34, Block C',
    'Unit 7, Commercial Zone', 'Shop 99, Anarkali Bazaar', 'Plot 22, SITE Area',
    'Shop 3, Saddar Bazaar', 'Warehouse 8, Port Qasim', 'Shop 15, Liberty Market',
    'Plot 67, I-10 Industrial', 'Shop 44, Raja Bazaar', 'Unit 2, Korangi Industrial',
];

var cities = [
    'Karachi', 'Lahore', 'Rawalpindi', 'Islamabad', 'Faisalabad',
    'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Gujranwala',
    'Sialkot', 'Sukkur', 'Larkana', 'Khuzdar', 'Abbottabad',
];

var provinces = {
    'Karachi': 'Sindh', 'Lahore': 'Punjab', 'Rawalpindi': 'Punjab',
    'Islamabad': 'Punjab', 'Faisalabad': 'Punjab', 'Multan': 'Punjab',
    'Peshawar': 'KPK', 'Quetta': 'Balochistan', 'Hyderabad': 'Sindh',
    'Gujranwala': 'Punjab', 'Sialkot': 'Punjab', 'Sukkur': 'Sindh',
    'Larkana': 'Sindh', 'Khuzdar': 'Balochistan', 'Abbottabad': 'KPK',
};

var reporters = [
    'Rana Adil', 'Rana Abubakar', 'Hamza Siddiqui', 'Usman Farooq',
    'Ali Hassan', 'Sara Khan', 'Maria Ahmed', 'Zara Malik',
    'Omar Sheikh', 'Bilal Raza',
];

var clients = ['OneWorld IP', 'A.A & Associates', 'SafeMark IP'];

// Payment terms by client
function paymentDays(client) {
    if (client === 'SafeMark IP') return 45;
    return 90; // OneWorld IP and A.A & Associates
}

// ── Build base case info ───────────────────────────────────────────────────

var usedBrandTargetCombos = {};

function makeBaseCase(submissionDateStr) {
    var brand = pickRandom(brands);
    var city = pickRandom(cities);
    var target = pickRandom(targetNames);
    var street = pickRandom(streets);
    return {
        'Case ID': '',
        'Brand Name': brand,
        'Product Name': pickRandom(products),
        'Target Name': target,
        'Target Category': pickRandom(categories),
        'Target Address': street + ', ' + city,
        'City': city,
        'Province': provinces[city],
        'Submission Date': submissionDateStr,
        'Case Reported By': pickRandom(reporters),
        'Case Uploaded To': '',
        'Case Upload Date': '',
        'Case Status': '',
        'Case Approved': '',
        'Case Approved Date': '',
        'Case Rejected': '',
        'Case Rejected Date': '',
        'Our Fee USD': '',
        'InDepth Due Date': '',
        'InDepth Status': '',
        'InDepth Status Date': '',
        'Enforcement Due Date': '',
        'Enforcement Status': '',
        'Enforcement Status Date': '',
        'Final Report Status': '',
        'Final Report Submission Date': '',
        'Invoice Issue Date': '',
        'Invoice Due Date': '',
        'Invoice Status': '',
        'Invoice Status Date': '',
        'Destruction Due Date': '',
        'Destruction Status': '',
        'Destruction Status Date': '',
        'Remarks': '',
    };
}

// ── Date Pool: spread across last 12 months ───────────────────────────────
// We'll work backwards from today (Feb 2026) so all dates are realistic

var datePool = [
    // Format: DD/MM/YYYY — submission dates spread over the past year
    '05/02/2025', '12/02/2025', '18/02/2025', '24/02/2025',
    '03/03/2025', '10/03/2025', '17/03/2025', '24/03/2025',
    '01/04/2025', '08/04/2025', '15/04/2025', '22/04/2025',
    '05/05/2025', '12/05/2025', '19/05/2025', '26/05/2025',
    '02/06/2025', '09/06/2025', '16/06/2025', '23/06/2025',
    '07/07/2025', '14/07/2025', '21/07/2025', '28/07/2025',
    '04/08/2025', '11/08/2025', '18/08/2025', '25/08/2025',
    '01/09/2025', '08/09/2025', '15/09/2025', '22/09/2025',
    '06/10/2025', '13/10/2025', '20/10/2025', '27/10/2025',
    '03/11/2025', '10/11/2025', '17/11/2025', '24/11/2025',
    '01/12/2025', '08/12/2025', '15/12/2025', '22/12/2025',
    '05/01/2026', '12/01/2026', '19/01/2026', '26/01/2026',
    '02/02/2026', '09/02/2026',
];

// ── Row Builders ───────────────────────────────────────────────────────────

function makeInHandRow(submDate) {
    var row = makeBaseCase(submDate);
    row['Case Status'] = 'IN_HAND';
    // IN_HAND: NO client, NO fee, NO workflow data — just basic case info
    return row;
}

function makeUploadedRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Status'] = 'UPLOADED';
    // UPLOADED: Has client + fee. NO approval or workflow data yet.
    return row;
}

function makeApprovedRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    var enforcementDueDate = addDays(indepthDueDate, 7);
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['Enforcement Due Date'] = enforcementDueDate;
    // APPROVED: Dates set but InDepth not started yet — no InDepth Status
    row['Case Status'] = 'APPROVED';
    return row;
}

function makeRejectedRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var rejectedDate = addDays(uploadDate, randomBetween(3, 7));
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Rejected'] = 'Yes';
    row['Case Rejected Date'] = rejectedDate;
    // REJECTED: NO in-depth, enforcement, or any further workflow data
    row['Case Status'] = 'REJECTED';
    return row;
}

function makeInDepthRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    var enforcementDueDate = addDays(indepthDueDate, 7);
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['InDepth Status'] = 'In-Progress';
    // IN_DEPTH: InDepth in progress — no InDepth Status Date yet, Enforcement date set
    row['Enforcement Due Date'] = enforcementDueDate;
    row['Case Status'] = 'IN_DEPTH';
    return row;
}

function makeEnforcementRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    // InDepth completed on or around the due date
    var indepthStatusDate = addDays(indepthDueDate, randomBetween(-1, 2));
    var enforcementDueDate = addDays(indepthDueDate, 7);
    // Destruction due 1 day after enforcement due date (not yet done, so use due date as reference)
    var destructionDueDate = addDays(enforcementDueDate, 1);
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['InDepth Status'] = 'Done';
    row['InDepth Status Date'] = indepthStatusDate;
    row['Enforcement Due Date'] = enforcementDueDate;
    row['Enforcement Status'] = 'In-Progress';
    // ENFORCEMENT: Destruction date set (1 day after enforcement due date)
    row['Destruction Due Date'] = destructionDueDate;
    row['Case Status'] = 'ENFORCEMENT';
    return row;
}

function makeFinalReportRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    var indepthStatusDate = addDays(indepthDueDate, randomBetween(-1, 2));
    var enforcementDueDate = addDays(indepthDueDate, 7);
    var enforcementStatusDate = addDays(enforcementDueDate, randomBetween(-1, 2));
    // Destruction due 1 day after enforcement done
    var destructionDueDate = addDays(enforcementStatusDate, 1);
    // Final report submitted a few days after enforcement done
    var finalReportDate = addDays(enforcementStatusDate, randomBetween(2, 5));
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['InDepth Status'] = 'Done';
    row['InDepth Status Date'] = indepthStatusDate;
    row['Enforcement Due Date'] = enforcementDueDate;
    row['Enforcement Status'] = 'Done';
    row['Enforcement Status Date'] = enforcementStatusDate;
    row['Final Report Status'] = 'Done';
    row['Final Report Submission Date'] = finalReportDate;
    row['Destruction Due Date'] = destructionDueDate;
    row['Destruction Status'] = 'In-Progress';
    // Enforcement done, destruction started but not done yet
    row['Case Status'] = 'DESTRUCTION';
    return row;
}

function makeInvoicedRow(submDate, invoiceStatusOverride) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    var indepthStatusDate = addDays(indepthDueDate, randomBetween(-1, 2));
    var enforcementDueDate = addDays(indepthDueDate, 7);
    var enforcementStatusDate = addDays(enforcementDueDate, randomBetween(-1, 2));
    var destructionDueDate = addDays(enforcementStatusDate, 1);
    var finalReportDate = addDays(enforcementStatusDate, randomBetween(2, 5));
    // Invoice issued after enforcement done
    var invoiceIssueDate = addDays(enforcementStatusDate, randomBetween(1, 3));
    var payDays = paymentDays(client);
    var invoiceDueDate = addDays(invoiceIssueDate, payDays);
    var invStatus = invoiceStatusOverride || (Math.random() > 0.4 ? 'Issued' : 'Not Paid');
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['InDepth Status'] = 'Done';
    row['InDepth Status Date'] = indepthStatusDate;
    row['Enforcement Due Date'] = enforcementDueDate;
    row['Enforcement Status'] = 'Done';
    row['Enforcement Status Date'] = enforcementStatusDate;
    row['Final Report Status'] = 'Done';
    row['Final Report Submission Date'] = finalReportDate;
    row['Invoice Issue Date'] = invoiceIssueDate;
    row['Invoice Due Date'] = invoiceDueDate;
    row['Invoice Status'] = invStatus;
    row['Destruction Due Date'] = destructionDueDate;
    row['Destruction Status'] = 'In-Progress';
    // Destruction still in progress, invoice issued/not paid
    row['Case Status'] = 'DESTRUCTION';
    return row;
}

function makeClosedRow(submDate) {
    var row = makeBaseCase(submDate);
    var client = pickRandom(clients);
    var uploadDate = addDays(submDate, randomBetween(2, 5));
    var approvedDate = addDays(uploadDate, randomBetween(3, 7));
    var indepthDueDate = addDays(approvedDate, 7);
    var indepthStatusDate = addDays(indepthDueDate, randomBetween(-1, 2));
    var enforcementDueDate = addDays(indepthDueDate, 7);
    var enforcementStatusDate = addDays(enforcementDueDate, randomBetween(-1, 2));
    var destructionDueDate = addDays(enforcementStatusDate, 1);
    var finalReportDate = addDays(enforcementStatusDate, randomBetween(2, 5));
    var invoiceIssueDate = addDays(enforcementStatusDate, randomBetween(1, 3));
    var payDays = paymentDays(client);
    var invoiceDueDate = addDays(invoiceIssueDate, payDays);
    // Invoice paid before due date
    var invoiceStatusDate = addDays(invoiceIssueDate, randomBetween(10, payDays - 5));
    // Destruction done after invoice paid
    var destructionStatusDate = addDays(destructionDueDate, randomBetween(3, 14));
    var fee = randomBetween(500, 2500);

    row['Case Uploaded To'] = client;
    row['Case Upload Date'] = uploadDate;
    row['Our Fee USD'] = fee;
    row['Case Approved'] = 'Yes';
    row['Case Approved Date'] = approvedDate;
    row['InDepth Due Date'] = indepthDueDate;
    row['InDepth Status'] = 'Done';
    row['InDepth Status Date'] = indepthStatusDate;
    row['Enforcement Due Date'] = enforcementDueDate;
    row['Enforcement Status'] = 'Done';
    row['Enforcement Status Date'] = enforcementStatusDate;
    row['Final Report Status'] = 'Done';
    row['Final Report Submission Date'] = finalReportDate;
    row['Invoice Issue Date'] = invoiceIssueDate;
    row['Invoice Due Date'] = invoiceDueDate;
    row['Invoice Status'] = 'Paid';
    row['Invoice Status Date'] = invoiceStatusDate;
    row['Destruction Due Date'] = destructionDueDate;
    row['Destruction Status'] = 'Done';
    row['Destruction Status Date'] = destructionStatusDate;
    // CLOSED: Everything complete, invoice paid, destruction done
    row['Case Status'] = 'CLOSED';
    return row;
}

// ── Generate 50 Rows ───────────────────────────────────────────────────────
// Distribution: IN_HAND=8, UPLOADED=6, APPROVED=3, REJECTED=3,
//               IN_DEPTH=6, ENFORCEMENT=6, DESTRUCTION=13, CLOSED=5

var rows = [];
var dateIdx = 0;

function nextDate() {
    var d = datePool[dateIdx % datePool.length];
    dateIdx++;
    return d;
}

// IN_HAND (8 rows) — recent submission dates (last 2 months)
var inHandDates = ['02/02/2026','05/02/2026','08/02/2026','10/02/2026','14/01/2026','17/01/2026','20/01/2026','24/01/2026'];
for (var i = 0; i < 8; i++) rows.push(makeInHandRow(inHandDates[i]));

// UPLOADED (6 rows) — uploaded but awaiting decision
var uploadedDates = ['15/01/2026','10/01/2026','05/01/2026','22/12/2025','15/12/2025','08/12/2025'];
for (var i = 0; i < 6; i++) rows.push(makeUploadedRow(uploadedDates[i]));

// APPROVED (3 rows) — approved, in-depth date set but not started
var approvedDates = ['01/12/2025','24/11/2025','17/11/2025'];
for (var i = 0; i < 3; i++) rows.push(makeApprovedRow(approvedDates[i]));

// REJECTED (3 rows)
var rejectedDates = ['03/11/2025','27/10/2025','20/10/2025'];
for (var i = 0; i < 3; i++) rows.push(makeRejectedRow(rejectedDates[i]));

// IN_DEPTH (6 rows)
var inDepthDates = ['13/10/2025','06/10/2025','29/09/2025','22/09/2025','15/09/2025','08/09/2025'];
for (var i = 0; i < 6; i++) rows.push(makeInDepthRow(inDepthDates[i]));

// ENFORCEMENT (6 rows)
var enforcementDates = ['01/09/2025','25/08/2025','18/08/2025','11/08/2025','04/08/2025','28/07/2025'];
for (var i = 0; i < 6; i++) rows.push(makeEnforcementRow(enforcementDates[i]));

// FINAL_REPORT (5 rows)
var finalReportDates = ['21/07/2025','14/07/2025','07/07/2025','23/06/2025','16/06/2025'];
for (var i = 0; i < 5; i++) rows.push(makeFinalReportRow(finalReportDates[i]));

// INVOICED (8 rows) — mix of Issued and Not Paid
var invoicedDates = ['09/06/2025','02/06/2025','26/05/2025','19/05/2025','12/05/2025','05/05/2025','22/04/2025','15/04/2025'];
var invStatuses = ['Issued','Issued','Not Paid','Issued','Not Paid','Issued','Issued','Not Paid'];
for (var i = 0; i < 8; i++) rows.push(makeInvoicedRow(invoicedDates[i], invStatuses[i]));

// CLOSED (5 rows) — all done, invoice paid
var closedDates = ['08/04/2025','01/04/2025','24/03/2025','17/03/2025','10/03/2025'];
for (var i = 0; i < 5; i++) rows.push(makeClosedRow(closedDates[i]));

// Shuffle rows so statuses are mixed (realistic data)
for (var i = rows.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = rows[i];
    rows[i] = rows[j];
    rows[j] = temp;
}

// ── Write Excel File ───────────────────────────────────────────────────────

var ws = XLSX.utils.json_to_sheet(rows, {
    header: [
        'Case ID', 'Brand Name', 'Product Name', 'Target Name', 'Target Category',
        'Target Address', 'City', 'Province', 'Submission Date', 'Case Reported By',
        'Case Uploaded To', 'Case Upload Date', 'Case Status',
        'Case Approved', 'Case Approved Date',
        'Case Rejected', 'Case Rejected Date',
        'Our Fee USD',
        'InDepth Due Date', 'InDepth Status', 'InDepth Status Date',
        'Enforcement Due Date', 'Enforcement Status', 'Enforcement Status Date',
        'Final Report Status', 'Final Report Submission Date',
        'Invoice Issue Date', 'Invoice Due Date', 'Invoice Status', 'Invoice Status Date',
        'Destruction Due Date', 'Destruction Status', 'Destruction Status Date',
        'Remarks',
    ],
});

var wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Cases');
XLSX.writeFile(wb, 'DAP_Import_Ready.xlsx');

console.log('');
console.log('✅ DAP_Import_Ready.xlsx generated successfully!');
console.log('');
console.log('Distribution:');
var counts = {};
rows.forEach(function(r) {
    counts[r['Case Status']] = (counts[r['Case Status']] || 0) + 1;
});
Object.keys(counts).sort().forEach(function(s) {
    console.log('  ' + s + ': ' + counts[s]);
});
console.log('  TOTAL: ' + rows.length + ' rows');
console.log('');
console.log('Ready to import via the Import Cases button in the app.');
