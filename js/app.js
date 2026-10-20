// Вхідні дані курсів валют та поріг для класу big-rate
const courses = {
  USD: 1,
  EUR: 0.92,
  UAH: 41.5,
  GBP: 0.79,
  PLN: 3.95
};

const threshold = 10;

// Крок 2: Видалення статичної заглушки з HTML
const placeholder = document.querySelector('#static-placeholder');
if (placeholder) {
  placeholder.remove();
}

// Крок 3: Вибір контейнерів та елементів
const ratesList = document.querySelector('#rates-list');
const ratesCount = document.querySelector('#rates-count');
const fromSelect = document.querySelector('#from-select');
const toSelect = document.querySelector('#to-select');

/**
 * Рендерит список курсів валют у контейнер #rates-list (Варіант №6)
 * @param {Object} ratesData - Об'єкт із курсами валют
 */
function renderRates(ratesData) {
  if (!ratesList) return;

  // Очищення контейнера
  ratesList.innerHTML = '';

  const entries = Object.entries(ratesData);

  // Кроки 4-7: Цикл створення та додавання елементів li
  entries.forEach(([currency, rate]) => {
    const li = document.createElement('li');

    // Крок 5: Заповнення textContent у форматі «USD: 1»
    li.textContent = `${currency}: ${rate}`;

    // Крок 6: Встановлення атрибута data-rate та умовного класу big-rate
    li.dataset.rate = rate;
    if (rate > threshold) {
      li.classList.add('big-rate');
    }

    // Крок 7: Додавання елемента в контейнер
    ratesList.append(li);
  });

  // Крок 9: Оновлення підсумкового елемента
  if (ratesCount) {
    ratesCount.textContent = `Кількість валют у списку: ${entries.length}`;
  }
}

/**
 * Синхронізує та динамічно заповнює селектори выбору валют
 * @param {Object} ratesData - Об'єкт із курсами валют
 */
function updateSelectOptions(ratesData) {
  if (!fromSelect || !toSelect) return;

  const currencies = Object.keys(ratesData);

  // Генерація елементів <option> для кожної валюти
  const optionsHTML = currencies
    .map(code => `<option value="${code}">${code}</option>`)
    .join('');

  fromSelect.innerHTML = optionsHTML;
  toSelect.innerHTML = optionsHTML;

  // Встановлення початкових значень за замовчуванням
  if (currencies.includes('USD')) fromSelect.value = 'USD';
  if (currencies.includes('UAH')) toSelect.value = 'UAH';
}

// Крок 8: Ініціалізація та виклик функцій при завантаженні
renderRates(courses);
updateSelectOptions(courses);