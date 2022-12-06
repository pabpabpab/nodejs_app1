import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import readline from 'readline';
import { Worker } from 'worker_threads';


import EventEmitter from 'events';
class MyEventEmitter extends EventEmitter {};
const emitter = new MyEventEmitter();


const USER_PATH_RECEIVED = 'USER_PATH_RECEIVED';
const USER_PATH_READY = 'USER_PATH_READY';
const FOLDER_SELECTED = 'FOLDER_SELECTED';
const SEARCH_STRING_RECEIVED = 'SEARCH_STRING_RECEIVED';

// Так как все должно быть асинхронное, то буду строить приложение полностью на событиях
emitter.on(USER_PATH_RECEIVED, handleUserPath);
emitter.on(USER_PATH_READY, readDirectory);
emitter.on(FOLDER_SELECTED, askWhatToSearch);
emitter.on(SEARCH_STRING_RECEIVED, searchByWorker); // сам поиск в обработчике передается воркеру


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

// Обработчик события "SEARCH_STRING_RECEIVED" воркером
// Перебирать файлы в выбранной папке из запускать событие для поиска строки в каждом файле
function searchByWorker({ dirPath, wanted }) {
    const workerData = { dirPath, wanted };
    const worker = new Worker('./worker_for_searcher.js', { workerData });
    // вывод результата поиска из воркера
    worker.on("message", console.log);
}

// Здесь мог бы быть дальнейший код (задачи)...
