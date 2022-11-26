import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Разработано на случай произвольного кол-ва ip
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

// The 'readable' event is emitted when there is data available to be read from the stream
// or when the end of the stream has been reached
// поэтому делаем once
readStream.once('readable', () => {
    console.log('Start of reading.');
});

// здесь будет хвостик чанка
let rest = '';

// Чтение данных происходит порционно
readStream.on('data', (chunk) => {

    // инициировать объект с пропсами-контейнерами для фильтрованных логов
    const filteredLogs = {};
    ips.forEach((ip) => {
        filteredLogs[ip] = [];
    })

    // разбить чанк на массив строк
    const lines = chunk.split('\n');

    // Склейка остатков.
    // Чанк может обрезаться по середине строки,
    // приклеить остаток с предыдущего чанка.
    lines[0] = rest + lines[0];
    // На последнем чанке лимит цикла будет другой чем на предыдущих чанках
    let linesLimit;
    if (Math.ceil(chunk.length/1024) < 64) {
        // длина чанка меньше 64 кб, значит это последний чанк
        linesLimit = lines.length;
    } else {
        // длина чанка равна 64 кб, значит это не последний чанк
        linesLimit = lines.length - 1;
        // сохранить хвостик для склейки на следующем цикле
        rest = lines[lines.length - 1];
    }

    // для каждой строки делать проверку на заданные ip
    // и записывать в соответствующий filteredLogs[ip]
    for (let i = 0; i < linesLimit; i++) {
        const line = lines[i];
        // если пустая строка, то continue
        if (!Boolean(line.trim())) {
            continue;
        }
        ips.forEach((ip) => {
            if (regExps[ip].test(line)) {
                filteredLogs[ip].push(line);
                return; // выход из forEach
            }
        })
    }

    // передать фильтрованные по каждому ip логи соответствующему writable-потоку
    ips.forEach((ip) => {
        writeStreams[ip].write(filteredLogs[ip].join('\n') + '\n');
    })
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