import colors from 'colors';

const [border1, border2] = process.argv.splice(2)

// Валидация аргументов
function getValidationErrors(border1, border2) {
    const errors = [];
    if (!/^\d+$/.test(String(border1))) {
        errors.push('Первый предел не целое число.');
    }
    if (!/^\d+$/.test(String(border2))) {
        errors.push('Второй предел не целое число.');
    }
    if (errors.length > 0) {
        return errors;
    }
    if (border2 <= border1) {
        errors.push('Предел-2 меньше или равен Предела-1');
    }
    return errors;
}

// Проверка одного числа на простое число
function isSimpleNumber(n) {
    if (n <= 1) {
        return false;
    }

    if ([2, 3, 5, 7].includes(n)) {
        return true;
    }

    const lastChar = [...String(n)].reverse()[0];
    if (['0', '2', '4', '5', '6', '8'].includes(lastChar)) {
        return false;
    }

    const thirdPart = Math.ceil(n/3);
    for (let i = 3; i <= thirdPart; i++) {
        if ((n % i) === 0) {
            return false;
        }
    }

    return true;
}

// Вывести простые числа
function displaySimpleNumbers(border1, border2) {
    const errors = getValidationErrors(border1, border2);
    if (errors.length > 0) {
        console.log(colors.red(errors.join('\n')));
        return;
    }

    const book = {
        1: 'green',
        2: 'yellow',
        3: 'red'
    }
    let colorIndex = 1;

    let isThereSimpleNumber = false;

    for(let n = border1; n <= border2; n++) {
        if (!isSimpleNumber(n)) {
            continue;
        }
        isThereSimpleNumber = true;
        console.log(colors[book[colorIndex]](n));
        colorIndex++;
        if (colorIndex > 3) {
            colorIndex = 1;
        }
    }

    if (!isThereSimpleNumber) {
        console.log(colors.red('Нет простых чисел в этом диапазоне.'))
    }
}

// Запуск вывода простых чисел в консоль
displaySimpleNumbers(Number(border1), Number(border2));



