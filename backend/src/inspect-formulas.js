import XLSX from 'xlsx';

const filePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';
const workbook = XLSX.readFile(filePath, { bookDeps: true });

const sheetName = '2.재단(VM)작업';
const sheet = workbook.Sheets[sheetName];

console.log('Cell A8:', sheet['A8']);
console.log('Cell B8 (Structure):', sheet['B8']);
console.log('Cell C8 (Width):', sheet['C8']);
console.log('Cell D8 (Height):', sheet['D8']);
console.log('Cell F8 (Qty):', sheet['F8']);
console.log('Cell G8 (Inner W):', sheet['G8']);
console.log('Cell H8 (Inner W Qty):', sheet['H8']);
console.log('Cell I8 (Inner H):', sheet['I8']);
console.log('Cell J8 (Inner H Qty):', sheet['J8']);
console.log('Cell K8 (Outer TB):', sheet['K8']);
console.log('Cell L8 (Outer TB Qty):', sheet['L8']);
console.log('Cell M8 (Outer LR):', sheet['M8']);
console.log('Cell N8 (Outer LR Qty):', sheet['N8']);
