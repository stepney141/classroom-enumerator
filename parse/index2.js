const fs = require('fs');
const pdf = require('pdf-parse');

const filename = "./2021年度秋学期_全学共通_選択科目.pdf"
const buf = fs.readFileSync(filename);

pdf( buf ).then( function( data ){
    fs.writeFile("./test2.txt", data.text, (err) => {
        if (err) throw err;
        console.log('正常に書き込みが完了しました');
    });
}).catch( function( err ){
  console.log( err );
});
