const { createApp } = Vue;

const STORAGE_KEY = 'conversionHistory';
const MIGRATED_FLAG_KEY = 'conversionHistoryMigrated';
const DB_NAME = 'ConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// ==========================================
// Крок 2. Функції для роботи з localStorage
// ==========================================

/**
 * Зберігає масив історії конвертацій у localStorage у форматі JSON
 */
function saveToLocalStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Зчитує історію з localStorage з обробкою помилки парсингу пошкодженого JSON
 */
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Пошкоджені дані в localStorage:', error);
    return [];
  }
}

// ==========================================
// Кроки 5–7. Функції для роботи з IndexedDB
// ==========================================

/**
 * Відкриває базу даних IndexedDB та створює сховище "history" при першому запуску
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Додає або оновлює запис конвертації в об'єктному сховищі IndexedDB
 */
async function saveHistoryItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Отримує всі записи з об'єктного сховища IndexedDB
 */
async function getAllHistoryItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Видаляє запис за його унікальним ключем id з IndexedDB
 */
async function deleteHistoryItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Крок 8. Одноразова міграція наявних даних із localStorage в IndexedDB
 */
async function migrateLocalStorageToIndexedDB() {
  const alreadyMigrated = localStorage.getItem(MIGRATED_FLAG_KEY) === 'true';
  const existingItems = await getAllHistoryItems();

  if (!alreadyMigrated && existingItems.length === 0) {
    const legacyItems = loadFromLocalStorage();
    if (legacyItems.length > 0) {
      for (const item of legacyItems) {
        // Видаляємо старий id (якщо був), щоб IndexedDB згенерував новий через autoIncrement
        const { id, ...cleanRecord } = item;
        await saveHistoryItem(cleanRecord);
      }
    }
    localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
  }
}

// ==========================================
// Vue-компонент форми та історії конвертацій
// ==========================================

const ConverterForm = {
  template: `
    <section class="card converter-section">
      <div class="converter-header">
        <h2>Форма конвертації</h2>
      </div>

      <div v-if="loading" class="status-message">Завантаження актуальних курсів...</div>
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="!loading && !error" class="rates-info">Курси завантажено успішно.</div>

      <form class="converter-form" @submit.prevent="handleSaveConversion">
        <div class="form-group">
          <label for="amount-input">Кількість / Значення:</label>
          <input
            type="number"
            id="amount-input"
            v-model.number="amount"
            step="any"
            min="0.01"
            placeholder="0.00"
            required
          />
        </div>

        <div class="units-row">
          <div class="form-group field-unit">
            <label for="from-select">Звідки:</label>
            <select id="from-select" v-model="fromUnit">
              <option v-for="currency in currencies" :key="currency" :value="currency">
                {{ currency }}
              </option>
            </select>
          </div>

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
          <input type="text" id="result-output" :value="result" readonly placeholder="0.00" />
        </div>

        <button type="submit" class="btn-submit" :disabled="!result">
          Зберегти конвертацію
        </button>
      </form>
    </section>

    <section class="card history-section">
      <h2>Історія останніх 10 конвертацій</h2>

      <!-- Крок 11. Повідомлення про помилку IndexedDB -->
      <div v-if="dbError" class="error-message">{{ dbError }}</div>

      <p v-if="history.length === 0" class="status-message">
        Історія конвертацій порожня. Виконайте та збережіть першу конвертацію.
      </p>

      <ul v-else class="history-list">
        <li v-for="item in history" :key="item.id || item.timestamp" class="history-item">
          <div class="history-info">
            <span class="history-main">
              {{ item.amount }} {{ item.from }} &rarr; {{ item.result }} {{ item.to }}
            </span>
            <span class="history-time">{{ formatDate(item.timestamp) }}</span>
          </div>
          <button
            type="button"
            class="btn-delete"
            @click="handleDeleteItem(item.id)"
            title="Видалити запис"
          >
            Видалити
          </button>
        </li>
      </ul>
    </section>
  `,
  data() {
    return {
      amount: 1,
      fromUnit: 'USD',
      toUnit: 'EUR',
      rates: {},
      loading: false,
      error: '',
      dbError: '',
      history: []
    };
  },
  computed: {
    currencies() {
      return Object.keys(this.rates);
    },
    result() {
      if (!this.amount || this.amount <= 0 || Object.keys(this.rates).length === 0) return '';

      const fromRate = this.rates[this.fromUnit];
      const toRate = this.rates[this.toUnit];

      if (!fromRate || !toRate) return '';

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
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString('uk-UA');
    },
    // Крок 9. Завантаження, сортування за timestamp і вибір останніх 10 записів
    async refreshHistory() {
      try {
        const allItems = await getAllHistoryItems();
        allItems.sort((a, b) => b.timestamp - a.timestamp);
        this.history = allItems.slice(0, 10);
        this.dbError = '';
      } catch (err) {
        console.error('Помилка читання IndexedDB:', err);
        this.dbError = 'IndexedDB недоступна (можливо, увімкнено приватний режим). Дані завантажено з localStorage.';
        const fallbackItems = loadFromLocalStorage();
        fallbackItems.sort((a, b) => b.timestamp - a.timestamp);
        this.history = fallbackItems.slice(0, 10);
      }
    },
    // Збереження нової конвертації (модель даних Варіанту 6)
    async handleSaveConversion() {
      if (!this.result) return;

      const record = {
        from: this.fromUnit,
        to: this.toUnit,
        amount: Number(this.amount),
        result: Number(this.result),
        timestamp: Date.now()
      };

      try {
        await saveHistoryItem(record);
        // Дублюємо в localStorage для резервного збереження / перевірки Кроків 2-4
        const allItems = await getAllHistoryItems();
        saveToLocalStorage(allItems);
        await this.refreshHistory();
      } catch (err) {
        console.error('Помилка запису в IndexedDB:', err);
        this.dbError = 'Не вдалося зберегти запис у IndexedDB. Збережено локально в localStorage.';
        const fallbackItems = loadFromLocalStorage();
        fallbackItems.push({ id: Date.now(), ...record });
        saveToLocalStorage(fallbackItems);
        fallbackItems.sort((a, b) => b.timestamp - a.timestamp);
        this.history = fallbackItems.slice(0, 10);
      }
    },
    async handleDeleteItem(id) {
      try {
        await deleteHistoryItem(id);
        const allItems = await getAllHistoryItems();
        saveToLocalStorage(allItems);
        await this.refreshHistory();
      } catch (err) {
        console.error('Помилка видалення з IndexedDB:', err);
        this.dbError = 'Не вдалося видалити запис із бази даних.';
      }
    },
    async initStorage() {
      try {
        await migrateLocalStorageToIndexedDB();
      } catch (err) {
        console.error('Помилка міграції в IndexedDB:', err);
        this.dbError = 'Локальна база даних IndexedDB недоступна у цьому режимі браузера.';
      }
      await this.refreshHistory();
    }
  },
  mounted() {
    this.fetchRates();
    this.initStorage();
  }
};

const app = createApp({
  components: {
    ConverterForm
  }
});

app.mount('#app');
