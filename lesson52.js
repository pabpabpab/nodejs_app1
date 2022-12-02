import http from 'http'
import path from 'path'
import url from 'url'
import fsp from 'fs/promises'
import fs from 'fs'
import { Transform } from 'stream'

const PORT = process.env.PORT ?? 3000
const __dirname = process.cwd()

http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.writeHead(200, 'OK!!!');

    const { path = __dirname } = url.parse(request.url, true).query;

    const srcInfo = await fsp.stat(path);
    if (srcInfo.isFile()) {
        // если выбран файл
        response.write('<html><body><code>');
        mySendFile(path, response);
    } else {
        // если выбрана папка
        const dirData = await myReadDir(path);
        const html = `<html><body>${getDirHtml(dirData)}</body></html>`;
        response.end(html);
    }

}).listen(PORT, 'localhost', () => {
    console.log(`Server has been started on port http://localhost:${PORT}...`)
});

// Читать файл и передавать на response, преобразуя
function mySendFile(filePath, response) {
    const transformStream = new Transform({
        transform(chunk, encoding, callback) {
            let chunkStr = chunk.toString();
            // если длина чанка меньше 64 кб, значит это последний чанк
            if (Math.ceil(chunkStr.length/1024) < 64) {
                // на событиях потока не получается отловить конец данных, response уже закрывается, поэтому так
                chunkStr = chunkStr + '</code></body></html>';
            }
            const transformedChunk = chunkStr.replaceAll('\n', '<br>');
            this.push(transformedChunk);
            callback();
        }
    });
    const readStream = fs.createReadStream(filePath, 'utf-8');
    readStream.pipe(transformStream).pipe(response);
}

// Читает папку, возвращает массив объектов (элементов папки)
async function myReadDir(dirPath) {
    return fsp
        .readdir(dirPath)
        .then(async (list) => {
            const result = [];
            for (const item of list) {
                const srcInfo = await fsp.stat(path.join(dirPath, item));
                result.push({
                    name: item,
                    path: path.join(dirPath, item),
                    isFile: srcInfo.isFile(),
                    size: srcInfo.size >= 1024 ? Math.ceil(srcInfo.size/1024) + 'kb' : srcInfo.size + 'b'
                });
            }
            return result;
        });
}

// Преобразовать массив объектов (элементов папки) в html-верстку
function getDirHtml(dirData) {
    const items = dirData.map((item) => {
        return `<div style="display:flex;Justify-content:space-between;width:300px;padding: 10px 20px;">
                    <div>
                        <a href="/?path=${item.path}">
                            ${item.name}${item.isFile ? '' : '<b style="font-size:22px;"> /</b>'}
                        </a>
                    </div>
                    <div>
                        ${item.size}
                    </div>
                </div>`;
    });
    return items.join('');
}