import EventEmitter from 'events';
class MyEventEmitter extends EventEmitter {};
const emitter = new MyEventEmitter();

const PRINT_REMAINS_EVENT = 'PRINT_REMAINS_EVENT';
const STOP_TIMER_EVENT = 'STOP_TIMER_EVENT';


// В этом массиве будут объекты-задачи в формате {"дата", "дата в милисекундах", timerId}
const tasks = [];


// Обработчики событий
// =========================================
// Обработчик события - печать оставшегося времени для таймера
function printTime(taskIndex) {
    const {date, msTime, timerId} = tasks[taskIndex];
    const rest = Math.floor((msTime - Date.now()) / 1000);
    if (rest < 1) {
        emitter.emit(STOP_TIMER_EVENT, {date, timerId});
        return;
    }
    console.log(`Для таймера номер ${timerId} (дата ${date}) - осталось ${rest} секунд`);
}

// Обработчик события - остановка указанного таймера
function stopTimer({date, timerId}) {
    clearInterval(timerId);
    console.log(`Таймер номер ${timerId} (дата ${date}) завершил работу`);
}
// =========================================


// Регистрация обработчиков
// =========================================
emitter.on(PRINT_REMAINS_EVENT, printTime);
emitter.on(STOP_TIMER_EVENT, stopTimer);
// =========================================


// Обработка входных аргументов, создание задач и упаковка их в массив, запуск таймеров
// =========================================
const args = process.argv.splice(2);

emitter.setMaxListeners(args.length);

// элемент массива - дата и время в формате «час-день-месяц-год»
args.forEach((inputDate, taskIndex) => {
    const [hours, date, month, year] = inputDate.split('-').map(item => Number(item));
    const task = {
        date: inputDate,
        msTime: new Date(year, month-1, date, hours).getTime(), // Date.now() + 7000 * (taskIndex + 1)
        timerId: setInterval(() => emitter.emit(PRINT_REMAINS_EVENT, taskIndex), 1000)
    };
    tasks.push(task);
});
// =========================================
