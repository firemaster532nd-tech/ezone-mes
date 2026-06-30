import XLSX from 'xlsx';

const filePath = 'c:/Users/edwar/OneDrive/ezone-mes/upload/26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  
  const sheetsToInspect = [
    '2.재단(VM)작업',
    '2.1 재단작업(VT)',
    '차열재 재단(VM,VT)',
    '3. 1절곡(VM)',
    '3.2 절곡(VT)',
    '3.3 절곡(VT-보강대)',
    '5. 차열재 출하용(VM,VT,VAG)',
    '6. 라벨소요량'
  ];

  sheetsToInspect.forEach(name => {
    const sheet = workbook.Sheets[name];
    console.log(`\n=================== ${name} ===================`);
    if (!sheet) {
      console.log('Not found');
      return;
    }
    // 데이터가 들어있을 법한 8행~15행 출력 (A열부터 O열까지)
    for (let r = 7; r < 14; r++) {
      let row = [];
      for (let c = 0; c < 15; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      console.log(`Row ${r + 1}:`, row.join(' | '));
    }
  });
} catch (e) {
  console.error(e);
}
