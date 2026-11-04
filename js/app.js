const API_URL = 'https://api.frankfurter.dev/v1/latest';

// Об'єкт поточних курсів відносно обраної базової валюти
let courses = {};

// Масив історії конвертацій
const conversionHistory = [];

// Вибір DOM-елементів
const fromSelect = document.querySelector('#from-select');
const toSelect = document.querySelector('#to-select');
const amountInput = document.querySelector('#amount-input');
const resultOutput = document.querySelector('#result-output');
const converterForm = document.querySelector('#converter-form');
const historyList = document.querySelector('#history-list');

const btnSwap = document.querySelector('.btn-swap');
const btnRefresh = document.querySelector('#btn-refresh');
const statusMessage = document.querySelector('#status-message');
const errorMessage = document.querySelector('#error-message');
const ratesInfo = document.querySelector('#rates-info');
const submitBtn = document.querySelector('.btn-submit');

/**
 * Управління візуальним станом завантаження
 */
function showLoading(isLoading) {
  if (!statusMessage) return;

  if (isLoading) {
    statusMessage.textContent = 'Завантаження актуальних курсів...';
    statusMessage.style.display = 'block';
    if (submitBtn) submitBtn.disabled = true;
    if (btnRefresh) btnRefresh.disabled = true;
  } else {
    statusMessage.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
    if (btnRefresh) btnRefresh.disabled = false;
  }
}

/**
 * Відображення або приховування повідомлень про помилку
 */
function showError(message) {
  if (!errorMessage) return;

  if (message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  } else {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
  }
}

/**
 * Виконує асинхронний fetch-запит до Frankfurter API
 */
async function fetchRates(baseCurrency = 'USD') {
  showLoading(true);
  showError('');

  try {
    const response = await fetch(`${API_URL}?from=${baseCurrency}`);

    // Перевірка коду статусу (422 — непідтримувана валюта)
    if (!response.ok) {
      if (response.status === 422 || response.status === 404) {
        throw new Error('Перевірте код валюти');
      }
      throw new Error(`Сервер відповів кодом ${response.status}`);
    }

    const data = await response.json();

    courses = { [data.base]: 1, ...data.rates };

    if (ratesInfo) {
      ratesInfo.textContent = `Курси відносно ${data.base} станом на ${data.date}`;
    }

    updateSelectOptions(courses, data.base);
    calculateConversion();
  } catch (error) {
    console.error('Помилка виконання запиту:', error);

    if (error.message === 'Перевірте код валюти') {
      showError('Перевірте код валюти');
    } else {
      showError('Не вдалося завантажити дані. Перевірте мережеве з\'єднання.');
    }
  } finally {
    showLoading(false);
  }
}

/**
 * Динамічно заповнює та оновлює списки селекторів
 */
function updateSelectOptions(ratesData, currentBase) {
  if (!fromSelect || !toSelect) return;

  const currentFrom = fromSelect.value || currentBase || 'USD';
  const currentTo = toSelect.value || 'EUR';

  const currencies = Object.keys(ratesData);
  const optionsHTML = currencies
    .map(code => `<option value="${code}">${code}</option>`)
    .join('');

  fromSelect.innerHTML = optionsHTML;
  toSelect.innerHTML = optionsHTML;

  if (currencies.includes(currentFrom)) {
    fromSelect.value = currentFrom;
  }
  if (currencies.includes(currentTo)) {
    toSelect.value = currentTo;
  }
}

/**
 * Розраховує конвертацію за поточним курсом
 */
function calculateConversion() {
  if (!amountInput || !resultOutput || !fromSelect || !toSelect) return null;

  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    resultOutput.value = '';
    return null;
  }

  const fromCurrency = fromSelect.value;
  const toCurrency = toSelect.value;

  const fromRate = courses[fromCurrency];
  const toRate = courses[toCurrency];

  if (!fromRate || !toRate) {
    resultOutput.value = '';
    return null;
  }

  const result = (amount / fromRate) * toRate;
  const formattedResult = result.toFixed(2);
  resultOutput.value = formattedResult;

  return {
    amount,
    from: fromCurrency,
    to: toCurrency,
    result: formattedResult
  };
}

/**
 * Рендерить масив історії конвертацій
 */
function renderHistory(historyData) {
  if (!historyList) return;

  historyList.innerHTML = '';
  historyData.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.amount} ${item.from} = ${item.result} ${item.to}`;
    historyList.append(li);
  });
}

// Подія вводу для валідації суми
if (amountInput) {
  amountInput.addEventListener('input', () => {
    const val = parseFloat(amountInput.value);
    if (!isNaN(val) && val <= 0) {
      amountInput.setCustomValidity('Сума має бути додатною');
    } else {
      amountInput.setCustomValidity('');
    }
    calculateConversion();
  });
}

// При зміні базової валюти "Звідки" робимо новий запит до API
if (fromSelect) {
  fromSelect.addEventListener('change', () => {
    fetchRates(fromSelect.value);
  });
}

if (toSelect) {
  toSelect.addEventListener('change', calculateConversion);
}

// Подія для кнопки свапу валют місцями
if (btnSwap) {
  btnSwap.addEventListener('click', () => {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    fetchRates(fromSelect.value);
  });
}

// Подія для кнопки "Оновити курси"
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    const currentBase = fromSelect.value || 'USD';
    fetchRates(currentBase);
  });
}

// Обробка відправки форми
if (converterForm) {
  converterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const conversionData = calculateConversion();
    if (!conversionData) return;

    conversionHistory.push(conversionData);
    renderHistory(conversionHistory);

    converterForm.reset();
    if (resultOutput) resultOutput.value = '';
    fetchRates(fromSelect.value || 'USD');
  });
}

// Початкова ініціалізація даних при завантаженні сторінки
fetchRates('USD');