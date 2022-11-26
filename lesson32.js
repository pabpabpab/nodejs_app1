import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// На случай произвольного кол-ва ip
const ips = ['89.123.1.41', '34.48.240.111'];

// Удалить файлы фильтрованных логов если есть
ips.forEach((ip) => {
    let filePath = path.join(__dirname, 'logs', `${ip}_requests.log`);
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
    }
});

// Для каждого ip создать рег.выражение и writable-поток
const regExps = {};
const writeStreams = {};
ips.forEach((ip) => {
    regExps[ip] = new RegExp(`.*${ip}.*`);
    writeStreams[ip] = fs.createWriteStream(path.join(__dirname, 'logs', `${ip}_requests.log`), {
        flags: 'a',
        encoding: 'utf8'
    });
});

// Создание readable-потока для исходного файла
const readStream = fs.createReadStream(path.join(__dirname, 'logs', 'access.txt'), 'utf-8');

// Создать Readline для возможности обработки данных из readable-потока по одной строке
const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
});

// Событие получения строки Readline'ом
// The 'line' event is emitted whenever the input stream receives an end-of-line input (\n, \r, or \r\n)
rl.on('line', (line) => {
    // выйти из обработчика если строка пустая
    if (!Boolean(line.trim())) {
        return;
    }
    // в цикле проверка строки на соответствие каждому ip, прервать цикл при первом попадании
    ips.forEach((ip) => {
        if (regExps[ip].test(line)) {
            // передать прошедшую условие строку соответствующему writable-потоку
            writeStreams[ip].write(line + '\n');
            return; // выход из forEach
        }
    })
});

// The 'readable' event is emitted when there is data available to be read from the stream
// or when the end of the stream has been reached
// поэтому делаем once
readStream.once('readable', () => {
    console.log('Start of reading.');
});

// The 'end' event is emitted when there is no more data to be consumed from the stream.
readStream.on('end', () => {
    console.log('There will be no more data.');
});

// Обработка ошибки при чтении
readStream.on('error', (err) => console.log(err));

// Обработка ошибки при записи
ips.forEach((ip) => {
    writeStreams[ip].on('error', (err) => {
        console.log(`Error «${err}» occured for ${ip} file writing.`);
    });
});

// Readline close event
rl.on('close', (line) => {
    console.log('Readline closed.')
});

// Readline error event
rl.on('error', (err) => {
    console.log(`Readline error «${err}» occured.`)
});