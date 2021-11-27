const fs = require('fs'),
PDFParser = require("pdf2json");

const URL = new URLSearchParams()
const pdfParser = new PDFParser();
pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    const decoded_json = JSON.parse(decodeURI(JSON.stringify(pdfData)));
    const required_data = decoded_json["Pages"].flatMap(page_obj => page_obj["Texts"])
    // const required_data = decoded_json["Pages"].flatMap(page_obj => page_obj["Texts"]).map(obj => obj["R"][0]["T"])
    fs.writeFile("./test.json", JSON.stringify(required_data), (err) => {
        if (err) throw err;
        console.log('正常に書き込みが完了しました');
    });
});
pdfParser.loadPDF("./2021年度秋学期_全学共通_選択科目.pdf");
