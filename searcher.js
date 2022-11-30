#!/usr/bin/env node

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import readline from 'readline';

import EventEmitter from 'events';
class MyEventEmitter extends EventEmitter {};
const emitter = new MyEventEmitter();

const USER_PATH_RECEIVED = 'USER_PATH_RECEIVED';
const USER_PATH_READY = 'USER_PATH_READY';
const FOLDER_SELECTED = 'FOLDER_SELECTED';
const SEARCH_STRING_RECEIVED = 'SEARCH_STRING_RECEIVED';
const FILE_RECEIVED = 'FILE_RECEIVED';

// Так как все должно быть асинхронное, то буду строить приложение полностью на событиях (не знаю делают ли так в разработке)
emitter.on(USER_PATH_RECEIVED, handleUserPath);
emitter.on(USER_PATH_READY, readDirectory);
emitter.on(FOLDER_SELECTED, askWhatToSearch);
emitter.on(SEARCH_STRING_RECEIVED, iterateFolderForSearch);
emitter.on(FILE_RECEIVED, doSearch);

// Глобальная переменная "всего найденных вхождений в папке"
// (не знаю как лучше делать глобальную переменную)
let globalCount = 0;

// Задать путь к папке можно через флаг "-p", но параметр необязательный
const options = yargs(hideBin(process.argv))
    .usage("Usage: -p <path>")
    .option("p", { alias: "path", describe: "Path to file", type: "string" })
    .argv;

// Если путь не был задан, запросить его через Readline.question
if (!options.path) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question("Please enter the path to the file: ", (inputedPath) => {
        emitter.emit(USER_PATH_RECEIVED, inputedPath);
        rl.close();
    });
} else {
    emitter.emit(USER_PATH_RECEIVED, options.path);
}

// Обработчик события "USER_PATH_RECEIVED"
// Путь можно передать относительный или абсолютный, и это здесь анализируется
async function handleUserPath(userPath) {
    let filePath = '';
    if (/^[A-Z]:[\\/].+$/.test(userPath)) {
        filePath = userPath; // был передан абсолютный путь
    } else {
        const __dirname = process.cwd();
        filePath = path.join(__dirname, userPath); // был передан относительный пут
    }

    let src;
    try {
        src = await fsp.stat(filePath);
    } catch(err) {
        console.log('Такого файла или папки не существует.');
        process.exit(0);
    }

    let dirPath = '';
    // на случай если был указан файл, взять папку в которой он находится
    if (src.isFile()) {
        dirPath = path.dirname(filePath);
    } else {
        dirPath = filePath;
    }

    emitter.emit(USER_PATH_READY, dirPath);
}

// Обработчик события "USER_PATH_READY"
// В нем с помощью Inquirer можно выбрать текущую папку (и рекурсия прервется)
// или можно выбрать вложенную папку и эта функция вызовется снова
function readDirectory(dirPath) {
    console.log('Текущая папка:', dirPath);
    const stopChoice = 'Искать в текущей папке';
    fsp
        .readdir(dirPath)
        .then(async (list) => {
            const result = [];
            for (const item of list) {
                const srcInfo = await fsp.stat(path.join(dirPath, item));
                if (!srcInfo.isFile()) result.push(item);
            }
            return result;
        })
        .then((list) => {
            return inquirer.prompt({
                name: 'dirName',
                type: 'list',
                message: 'Выберите папку или остановитесь на текущей: ',
                choices: [stopChoice, ...list]
            });
        })
        .then(({ dirName }) => {
            if (dirName !== stopChoice) {
                readDirectory(path.join(dirPath, dirName));
            }
            console.log('Искать в папке: ', dirPath);
            emitter.emit(FOLDER_SELECTED, dirPath);
        });
}

// Обработчик события "FOLDER_SELECTED"
// Папка выбрана, спросить что в ней искать
function askWhatToSearch(dirPath) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(`Введите что искать в выбранной папке: `, (wanted) => {
        emitter.emit(SEARCH_STRING_RECEIVED, { dirPath, wanted });
        rl.close();
    });
}

// Обработчик события "SEARCH_STRING_RECEIVED"
// Перебирать файлы в выбранной папке из запускать событие для поиска строки в каждом файле
function iterateFolderForSearch({ dirPath, wanted }) {
    console.log(`В папке ${dirPath} будем искать: `, wanted);
    const regExp = new RegExp(`.*${wanted}.*`, 'gi');
    fsp
        .readdir(dirPath)
        .then(async (list) => {
            const result = [];
            for (const item of list) {
                const srcInfo = await fsp.stat(path.join(dirPath, item));
                if (srcInfo.isFile()) result.push(item);
            }
            return result;
        })
        .then((list) => {
            list.forEach((item, i, arr) => {
                const filePath = path.join(dirPath, item);
                emitter.emit(FILE_RECEIVED, { filePath, regExp, lastFile: i+1 === arr.length});
            });
        });
}

// Обработчик события "FILE_RECEIVED"
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
            console.log('Не найдено ни одного вхождения этой строки.');
        }
        if (count === 0) {
            return;
        }
        console.log(`${path.basename(filePath)} - вхождений ${count}.`);
    });

    readStream.on('error', (err) => {
        console.log(`Ошибка ${err} readable-потока файла ${filePath}.`);
    });

    rl.on('error', (err) => {
        console.log(`Ошибка Readline «${err}» при чтении файла ${filePath}.`);
    });
}

/*
буду рад замечаниям
 */
