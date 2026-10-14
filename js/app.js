const courses = {
    USD: 1,
    EUR: 0.92,
    UAN: 41.5
}
const threshold = 100_000_000

// Show all course details in Console
function ShowCurses(courses) {
    for (let key in courses) {
        console.log(`${key}: ${courses[key]}`)
    }
}

// Convert amount according to its rate
const convert = (amount, rate) => amount * rate

ShowCurses(courses)

// Test 'IF/ELSE' statement with 'convert' func
const amount = 5_000_000
const rate = courses.UAN
const result = convert(amount, rate)
console.log(`Результат конвертації: ${result}`)

if (result > threshold) {
    console.log("Статус: Це велика сума.");
} else {
    console.log("Статус: Це невелика сума.");
}