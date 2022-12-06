import { Server } from 'socket.io'
import http from 'http'
import path from 'path'
import fs from 'fs'

const HOST = 'localhost'
const PORT = 3000

const server = http.createServer((req, res) => {
    const filePath = path.join(process.cwd(), './messenger.html');
    const rs = fs.createReadStream(filePath);
    rs.pipe(res);
});

const io = new Server(server);

server.listen(PORT, HOST, () =>
    console.log(`Server running at http://${HOST}:${PORT}`)
);


io.on('connection', (client) => {
    console.log('Websocket connected');

    client.nick = getNick();

    // Пришедшее событие с клиентской части - новое сообщение
    client.on('client-msg', (data) => {
        // отправка сообщения всем кроме автора сообщения
        client.broadcast.emit('server-msg', {
            nick: client.nick,
            msg: data.msg
        })
        // отправка автору его сообщения
        client.emit('server-msg', {
            nick: client.nick,
            msg: data.msg
        })
    })

    // При отключении клиента - уведомляем остальных
    client.on('disconnect', () => {
        // отправка сообщения всем о том что данный клиент вышел из чата
        client.broadcast.emit('server-msg', {
            nick: 'Bot',
            msg: `${client.nick} вышел из чата`
        })
    });

    // Пришедшее событие с клиентской части о переподключении
    client.on('client-reconnected', (userNick) => {
        // отправка сообщения всем о том что данный клиент переподключился
        client.broadcast.emit('server-msg', {
            nick: 'Bot',
            msg: `${userNick} переподключился`
        })
    });
});

// генерация ника
function getNick() {
    const index1 = Math.floor(Math.random() * 20);
    const index2 = Math.floor(Math.random() * 10);
    const index3 = Math.floor(Math.random() * 10);
    const index4 = Math.floor(Math.random() * 10);
    const firstChars = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('');
    const numbers = '0123456789'.split('');
    return firstChars[index1] + numbers[index2] + numbers[index3] + numbers[index4];
}