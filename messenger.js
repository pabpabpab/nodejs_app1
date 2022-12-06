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

    client.on('client-msg', (data) => {
        client.broadcast.emit('server-msg', {
            nick: client.nick,
            msg: data.msg
        })
        client.emit('server-msg', {
            nick: client.nick,
            msg: data.msg
        })
    })

    // При отключении клиента - уведомляем остальных
    client.on('disconnect', () => {
        client.broadcast.emit('server-msg', {
            nick: 'Bot',
            msg: `${client.nick} вышел из чата`
        })
    });

    client.on('client-reconnected', (userNick) => {
        client.broadcast.emit('server-msg', {
            nick: 'Bot',
            msg: `${userNick} переподключился`
        })
    });
});

function getNick() {
    const index1 = Math.floor(Math.random() * 20);
    const index2 = Math.floor(Math.random() * 10);
    const index3 = Math.floor(Math.random() * 10);
    const index4 = Math.floor(Math.random() * 10);
    const firstChars = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('');
    const numbers = '0123456789'.split('');
    return firstChars[index1] + numbers[index2] + numbers[index3] + numbers[index4];
}