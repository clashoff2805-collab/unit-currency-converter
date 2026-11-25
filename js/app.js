const { createApp } = Vue;

const STORAGE_KEY = 'conversionHistory';
const MIGRATED_FLAG_KEY = 'conversionHistoryMigrated';
const DB_NAME = 'ConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// ==========================================
// Робота з localStorage
// ==========================================

function saveToLocalStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

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
// Робота з IndexedDB
// ==========================================

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

async function saveHistoryItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllHistoryItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteHistoryItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateLocalStorageToIndexedDB() {
  const alreadyMigrated = localStorage.getItem(MIGRATED_FLAG_KEY) === 'true';
  const existingItems = await getAllHistoryItems();

  if (!alreadyMigrated && existingItems.length === 0) {
    const legacyItems = loadFromLocalStorage();
    if (legacyItems.length > 0) {
      for (const item of legacyItems) {
        const { id, ...cleanRecord } = item;
        await saveHistoryItem(cleanRecord);
      }
    }
    localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
  }
}

// ==========================================
// Vue-компонент форми, Canvas-графіка та історії
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

    <!-- Практична №12 (Варіант 6): Міні-графік історії конвертацій на Canvas -->
    <section class="card chart-section">
      <div class="chart-header">
        <h2>Динаміка результатів конвертацій</h2>
        <button
          type="button"
          class="btn-refresh"
          @click="toggleChartAnimation"
          :disabled="history.length === 0"
        >
          {{ isAnimating ? 'Пауза' : 'Відтворити графік' }}
        </button>
      </div>

      <p class="chart-subtitle">
        Наведіть курсор на точку графіка, щоб переглянути деталі операції
      </p>

      <div class="canvas-wrapper">
        <canvas
          ref="historyCanvas"
          id="history-chart"
          width="520"
          height="220"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
        ></canvas>
      </div>
    </section>

    <section class="card history-section">
      <h2>Історія останніх 10 конвертацій</h2>

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
      history: [],
      // Стан анімації та інтерактивності Canvas
      animationFrameId: null,
      isAnimating: false,
      animationProgress: 1,
      chartPoints: [],
      hoveredPointIndex: -1
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

      // Прив'язка анімації графіка до оновлення реальних даних історії
      this.hoveredPointIndex = -1;
      this.startChartAnimation(true);
    },
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
        this.startChartAnimation(true);
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
    },

    // ==========================================
    // Методи побудови та анімації графіка (Canvas)
    // ==========================================

    /**
     * Обчислює координати точок графіка на основі масиву this.history
     */
    computeChartPoints(width, height) {
      // Беремо історію в хронологічному порядку (зліва направо: від старіших до новіших)
      const chronological = [...this.history].reverse();
      if (chronological.length === 0) return [];

      const pad = { top: 34, right: 36, bottom: 34, left: 46 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;

      const values = chronological.map((item) => Number(item.result));
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal;

      return chronological.map((item, idx) => {
        const x =
          chronological.length === 1
            ? pad.left + plotW / 2
            : pad.left + (idx / (chronological.length - 1)) * plotW;

        const y =
          range === 0
            ? pad.top + plotH / 2
            : pad.top + plotH - ((Number(item.result) - minVal) / range) * plotH;

        return { x, y, item };
      });
    },

    /**
     * Запускає або продовжує цикл анімації через requestAnimationFrame
     */
    startChartAnimation(reset = false) {
      this.stopChartAnimation();

      const canvas = this.$refs.historyCanvas;
      if (!canvas) return;

      this.chartPoints = this.computeChartPoints(canvas.width, canvas.height);

      if (this.chartPoints.length === 0) {
        this.animationProgress = 1;
        this.drawChartFrame(1);
        return;
      }

      if (reset || this.animationProgress >= 1) {
        this.animationProgress = 0;
      }

      this.isAnimating = true;
      const duration = 750; // мс
      const startProgress = this.animationProgress;
      let startTime = null;

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const rawProgress = Math.min(1, startProgress + (elapsed / duration) * (1 - startProgress));

        // Плавне сповільнення в кінці (ease-out cubic)
        const easedProgress = 1 - Math.pow(1 - rawProgress, 3);
        this.animationProgress = rawProgress;

        this.drawChartFrame(easedProgress);

        if (rawProgress < 1 && this.isAnimating) {
          this.animationFrameId = requestAnimationFrame(step);
        } else {
          this.isAnimating = false;
          this.animationFrameId = null;
          this.drawChartFrame(1);
        }
      };

      this.animationFrameId = requestAnimationFrame(step);
    },

    /**
     * Коректна зупинка циклу анімації через cancelAnimationFrame
     */
    stopChartAnimation() {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.isAnimating = false;
    },

    /**
     * Перемикач Старт / Пауза для кнопки керування
     */
    toggleChartAnimation() {
      if (this.isAnimating) {
        this.stopChartAnimation();
      } else {
        this.startChartAnimation(this.animationProgress >= 1);
      }
    },

    /**
     * Відмальовує один кадр графіка з прогресом промальовування лінії [0..1]
     */
    drawChartFrame(progress) {
      const canvas = this.$refs.historyCanvas;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;

      // Обов'язкове очищення полотна перед кожним кадром
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Стан, коли історія ще порожня
      if (this.chartPoints.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Збережіть хоча б одну конвертацію для побудови графіка', width / 2, height / 2);
        ctx.restore();
        return;
      }

      const pad = { top: 34, right: 36, bottom: 34, left: 46 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;

      // 1. Фонова сітка та осі координат
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      const gridRows = 3;
      for (let i = 0; i <= gridRows; i++) {
        const gy = pad.top + (i / gridRows) * plotH;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(width - pad.right, gy);
        ctx.stroke();
      }

      // Підписи мін/макс значень по осі Y
      const values = this.chartPoints.map((p) => Number(p.item.result));
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(maxVal.toFixed(2), pad.left - 8, pad.top);
      ctx.fillText(minVal.toFixed(2), pad.left - 8, pad.top + plotH);

      const points = this.chartPoints;

      // 2. Ламана лінія між точками з урахуванням прогресу анімації
      if (points.length > 1 && progress > 0) {
        const totalSegments = (points.length - 1) * progress;
        const fullSegments = Math.floor(totalSegments);
        const partial = totalSegments - fullSegments;

        ctx.beginPath();
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= fullSegments; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }

        if (fullSegments < points.length - 1) {
          const p1 = points[fullSegments];
          const p2 = points[fullSegments + 1];
          const currX = p1.x + (p2.x - p1.x) * partial;
          const currY = p1.y + (p2.y - p1.y) * partial;
          ctx.lineTo(currX, currY);
        }

        ctx.stroke();
      }

      // 3. Вузлові точки та підписи значень
      const visibleCount =
        points.length === 1
          ? 1
          : Math.min(points.length, Math.floor((points.length - 1) * progress) + 1);

      for (let i = 0; i < visibleCount; i++) {
        const pt = points[i];
        const isHovered = i === this.hoveredPointIndex;

        // Зовнішнє кільце при наведенні миші
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(30, 58, 138, 0.2)';
          ctx.fill();
        }

        // Основна точка
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHovered ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#1d4ed8' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1e3a8a';
        ctx.stroke();

        // Підпис результату та валюти біля точки
        ctx.fillStyle = '#111827';
        ctx.font = isHovered
          ? 'bold 11px system-ui, -apple-system, sans-serif'
          : '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${pt.item.result} ${pt.item.to}`, pt.x, pt.y - 8);
      }

      // 4. Спливаюча підказка (tooltip) при наведенні на точку
      if (this.hoveredPointIndex >= 0 && this.hoveredPointIndex < points.length) {
        const hovered = points[this.hoveredPointIndex];
        const label = `${hovered.item.amount} ${hovered.item.from} → ${hovered.item.result} ${hovered.item.to}`;

        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const boxW = textWidth + 16;
        const boxH = 24;

        // Не виходимо за межі полотна зліва/справа
        let boxX = hovered.x - boxW / 2;
        boxX = Math.max(8, Math.min(width - boxW - 8, boxX));
        const boxY = height - boxH - 4;

        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2);
      }

      ctx.restore();
    },

    /**
     * Обробка руху миші по Canvas для підсвічування найближчої точки
     */
    handleCanvasMouseMove(event) {
      if (this.chartPoints.length === 0) return;

      const canvas = this.$refs.historyCanvas;
      const rect = canvas.getBoundingClientRect();

      // Масштабуємо координати кліка/курсора з урахуванням CSS-розміру елемента
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      let closestIdx = -1;
      let minDistance = 18; // радіус чутливості в пікселях

      this.chartPoints.forEach((pt, idx) => {
        const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
        if (dist <= minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (closestIdx !== this.hoveredPointIndex) {
        this.hoveredPointIndex = closestIdx;
        if (!this.isAnimating) {
          this.drawChartFrame(this.animationProgress);
        }
      }
    },

    handleCanvasMouseLeave() {
      if (this.hoveredPointIndex !== -1) {
        this.hoveredPointIndex = -1;
        if (!this.isAnimating) {
          this.drawChartFrame(this.animationProgress);
        }
      }
    }
  },
  mounted() {
    this.fetchRates();
    this.initStorage();
  },
  beforeUnmount() {
    // Гарантована зупинка анімації при знищенні компонента
    this.stopChartAnimation();
  }
};

const app = createApp({
  components: {
    ConverterForm
  }
});

app.mount('#app');
