// Крок 1. Обрано фреймворк Vue 3.
// Обґрунтування: Vue має зручну систему двостороннього зв'язування (v-model) та обчислюваних властивостей (computed), що ідеально підходить для автоматичного перерахунку результату без кнопок.

const { createApp } = Vue;

// Крок 4. Створення компонента
const ConverterForm = {
  template: `
    <div>
      <div v-if="loading" class="status-message" style="display: block;">Завантаження актуальних курсів...</div>
      <div v-if="error" class="error-message" style="display: block;">{{ error }}</div>
      <div v-if="!loading && !error" class="rates-info">Курси завантажено успішно.</div>

      <form class="converter-form" @submit.prevent>
        <div class="form-group">
          <label for="amount-input">Кількість / Значення:</label>
          <!-- Двостороннє зв'язування (v-model) -->
          <input type="number" id="amount-input" v-model.number="amount" step="any" min="0.01" placeholder="0.00" />
        </div>

        <div class="units-row">
          <div class="form-group field-unit">
            <label for="from-select">Звідки:</label>
            <select id="from-select" v-model="fromUnit">
              <!-- Крок 5. Рендер циклом v-for -->
              <option v-for="currency in currencies" :key="currency" :value="currency">
                {{ currency }}
              </option>
            </select>
          </div>

          <!-- Крок 6. Інтерактивна подія (зміна місцями) -->
          <button type="button" class="btn-swap" @click="swapRates" title="Поміняти місцями">⇄</button>

          <div class="form-group field-unit">
            <label for="to-select">Куди:</label>
            <select id="to-select" v-model="toUnit">
              <option v-for="currency in currencies" :key="currency" :value="currency">
                {{ currency }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="result-output">Результат:</label>
          <!-- Вивід похідного значення (computed) -->
          <input type="text" id="result-output" :value="result" readonly placeholder="0.00" />
        </div>
      </form>
    </div>
  `,
  // Крок 3. Реактивний стан компонента
  data() {
    return {
      amount: 1,
      fromUnit: 'USD',
      toUnit: 'EUR',
      rates: {},
      loading: false,
      error: ''
    };
  },
  computed: {
    currencies() {
      return Object.keys(this.rates);
    },
    // Похідне значення, яке перераховується автоматично при зміні amount, fromUnit або toUnit
    result() {
      if (!this.amount || this.amount <= 0 || Object.keys(this.rates).length === 0) return '';

      const fromRate = this.rates[this.fromUnit];
      const toRate = this.rates[this.toUnit];

      if (!fromRate || !toRate) return '';

      // Розрахунок через крос-курс відносно базової валюти
      return ((this.amount / fromRate) * toRate).toFixed(2);
    }
  },
  methods: {
    async fetchRates() {
      this.loading = true;
      this.error = '';
      try {
        const response = await fetch('https://api.frankfurter.dev/v1/latest?from=USD');
        if (!response.ok) throw new Error('Помилка сервера');

        const data = await response.json();
        // Додаємо базову валюту до списку курсів (USD = 1)
        this.rates = { [data.base]: 1, ...data.rates };
      } catch (err) {
        this.error = 'Не вдалося завантажити дані. Перевірте мережеве з\'єднання.';
      } finally {
        this.loading = false;
      }
    },
    swapRates() {
      const temp = this.fromUnit;
      this.fromUnit = this.toUnit;
      this.toUnit = temp;
    }
  },
  mounted() {
    // Автоматичне завантаження курсів при старті
    this.fetchRates();
  }
};

// Створення та монтування Vue-додатка
// Крок 7. Ручний DOM-код замінено на ініціалізацію фреймворку
const app = createApp({
  components: {
    ConverterForm
  }
});

app.mount('#app');
