import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import readline from 'readline';

const { dirPath, wanted } = workerData;

// Глобальная переменная "всего найденных вхождений в папке"
let globalCount = 0;

console.log(`В папке ${dirPath} будем искать: `, wanted);

const regExp = new RegExp(`.*${wanted}.*`, 'gi');

// Перебирать файлы в выбранной папке и вызывать функцию для поиска строки в каждом файле
fsp
    .readdir(dirPath)
    .then(async (list) => {
        const fileList = [];
        for (const item of list) {
            const srcInfo = await fsp.stat(path.join(dirPath, item));
            if (srcInfo.isFile()) fileList.push(item);
        }
        return fileList;
    })
    .then((list) => {
        list.forEach((item, i, arr) => {
            const filePath = path.join(dirPath, item);
            doSearch({ filePath, regExp, lastFile: i+1 === arr.length });
        });
    });

// Подсчет вхождений строки в одном файле (через поток и readline,
// поток как безопасный способ для больших файлов, маленькие файлы заодно,
// readline чтобы не выпадали совпадения на разрывах)
function doSearch({ filePath, regExp, lastFile }) {
    const readStream = fs.createReadStream(filePath, 'utf-8');
    const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity
    });

    let count = 0;
    rl.on('line', (line) => {
        count = count + (line.match(regExp) || []).length;
    });

    rl.on('close', () => {
        globalCount = globalCount + count;
        if (lastFile && globalCount === 0) {
            // В конце если ни одного вхождения не нашлось, вывести сообщение об этом
            parentPort.postMessage('Не найдено ни одного вхождения этой строки.');
        }
        if (count === 0) {
            return;
        }
        parentPort.postMessage(`${path.basename(filePath)} - вхождений ${count}.`);
    });

    readStream.on('error', (err) => {
        parentPort.postMessage(`Ошибка ${err} readable-потока файла ${filePath}.`);
    });

    rl.on('error', (err) => {
        parentPort.postMessage(`Ошибка Readline «${err}» при чтении файла ${filePath}.`);
    });
}













