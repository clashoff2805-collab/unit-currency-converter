// Вхідні дані курсів валют
const courses = {
  USD: 1,
  EUR: 0.92,
  UAH: 41.5,
  GBP: 0.79,
  PLN: 3.95
};

// Масив історії конвертацій (Варіант 6)
const conversionHistory = [];

// Вибір DOM-елементів
const fromSelect = document.querySelector('#from-select');
const toSelect = document.querySelector('#to-select');
const amountInput = document.querySelector('#amount-input');
const resultOutput = document.querySelector('#result-output');
const converterForm = document.querySelector('#converter-form');
const historyList = document.querySelector('#history-list');

/**
 * Синхронізує та динамічно заповнює селектори вибору валют
 */
function updateSelectOptions(ratesData) {
  if (!fromSelect || !toSelect) return;

  const currencies = Object.keys(ratesData);
  const optionsHTML = currencies
    .map(code => `<option value="${code}">${code}</option>`)
    .join('');

  fromSelect.innerHTML = optionsHTML;
  toSelect.innerHTML = optionsHTML;

  if (currencies.includes('USD')) fromSelect.value = 'USD';
  if (currencies.includes('UAH')) toSelect.value = 'UAH';
}

/**
 * Розраховує значення конвертації
 */
function calculateConversion() {
  if (!amountInput || !resultOutput || !fromSelect || !toSelect) return null;

  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    resultOutput.value = '';
    return null;
  }

  const fromRate = courses[fromSelect.value];
  const toRate = courses[toSelect.value];

  if (!fromRate || !toRate) return null;

  const result = (amount / fromRate) * toRate;
  const formattedResult = result.toFixed(2);
  resultOutput.value = formattedResult;

  return {
    amount,
    from: fromSelect.value,
    to: toSelect.value,
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

// ==========================================
// Обробники подій (Варіант 6)
// ==========================================

// Додаткова валідація поля кількості (input event)
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

// Перерахунок при зміні селекторів
if (fromSelect) {
  fromSelect.addEventListener('change', calculateConversion);
}
if (toSelect) {
  toSelect.addEventListener('change', calculateConversion);
}

// Обробка submit форми
if (converterForm) {
  converterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const conversionData = calculateConversion();
    if (!conversionData) return;

    conversionHistory.push(conversionData);
    renderHistory(conversionHistory);

    converterForm.reset();
    if (resultOutput) resultOutput.value = '';
    updateSelectOptions(courses);
  });
}

// Ініціалізація
updateSelectOptions(courses);