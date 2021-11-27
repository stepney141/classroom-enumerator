const fs = require('fs')
const pdfreader = require('pdfreader');

const nbCols = 26;
const cellPadding = 14; // each cell is padded to fit 40 characters

const columnQuantitizer = (item) => parseFloat(item.x) >= 20;

const padColumns = (array, nb) =>
  Array.apply(null, {length: nb}).map((val, i) => array[i] || []);
  // .. because map() skips undefined elements

const mergeCells = (cells) => (cells || [])
  .map((cell) => cell.text).join('') // merge cells
  .substr(0, cellPadding).padEnd(cellPadding, ' '); // padding

const renderMatrix = (matrix) => (matrix || [])
  .map((row, y) => padColumns(row, nbCols)
    .map(mergeCells)
    .join(' | ')
  ).join('\n');

let table = new pdfreader.TableParser();

fs.unlinkSync('./test3.txt');
new pdfreader.PdfReader().parseFileItems("./2021年度秋学期_全学共通_選択科目.pdf", function(err, item){
  if (!item || item.page) {
    // end of file, or page
      fs.appendFile("./test3.txt", renderMatrix(table.getMatrix()), (err) => {
        if (err) throw err;
        console.log('正常に書き込みが完了しました');
      });
    table = new pdfreader.TableParser(); // new/clear table for next page
  } else if (item.text) {
    // accumulate text items into rows object, per line
    table.processItem(item, columnQuantitizer(item));
  }
});
