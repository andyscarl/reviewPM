let selectedFile = null;
const charts = {};

// ---- File selection ----
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const filePreview = document.getElementById('file-preview');
const dropContent = dropZone.querySelector('.drop-content');
const analyzeBtn = document.getElementById('analyze-btn');

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropZone.addEventListener('click', (e) => {
  if (!e.target.closest('button')) fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

function setFile(file) {
  if (!file.name.endsWith('.txt')) {
    showUploadError('Solo se permiten archivos .txt');
    return;
  }
  hideUploadError();
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatBytes(file.size);
  filePreview.classList.remove('hidden');
  dropContent.classList.add('hidden');
  analyzeBtn.disabled = false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showUploadError(msg) {
  const el = document.getElementById('upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideUploadError() {
  document.getElementById('upload-error').classList.add('hidden');
}

// ---- Upload & analyze ----
async function uploadFile() {
  if (!selectedFile) return;

  hideUploadError();
  showLoading();

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      showUploadError(data.error || 'Error al procesar el archivo');
      return;
    }

    renderDashboard(data);
  } catch (err) {
    showUploadError('No se pudo conectar con el servidor');
  } finally {
    hideLoading();
  }
}

// ---- Dashboard rendering ----
function renderDashboard(data) {
  document.getElementById('upload-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');

  document.getElementById('dash-filename').textContent = data.filename;

  // KPIs
  const s = data.summary;
  document.getElementById('kpi-chars').textContent = s.totalChars.toLocaleString();
  document.getElementById('kpi-words').textContent = s.totalWords.toLocaleString();
  document.getElementById('kpi-unique').textContent = s.uniqueWords.toLocaleString();
  document.getElementById('kpi-lines').textContent = s.totalLines.toLocaleString();
  document.getElementById('kpi-avgline').textContent = s.avgLineLength;
  document.getElementById('kpi-avgwords').textContent = s.avgWordsPerLine;

  destroyCharts();

  renderTopWords(data.topWords);
  renderCharTypes(data.charTypes);
  renderLineLengths(data.lineLengthDistribution);
  renderWordLengths(data.wordLengthDistribution);
}

function destroyCharts() {
  Object.values(charts).forEach(c => c.destroy());
  Object.keys(charts).forEach(k => delete charts[k]);
}

const PALETTE = [
  '#6366f1','#818cf8','#a5b4fc',
  '#22d3ee','#34d399','#fbbf24',
  '#f87171','#c084fc','#fb923c',
  '#60a5fa','#4ade80','#e879f9',
  '#f472b6','#38bdf8','#a3e635',
];

function renderTopWords(topWords) {
  const ctx = document.getElementById('chart-top-words').getContext('2d');
  const labels = topWords.map(w => w.word);
  const values = topWords.map(w => w.count);

  charts.topWords = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frecuencia',
        data: values,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} veces` } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#2e3250' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#2e3250' }, beginAtZero: true },
      },
    },
  });
}

function renderCharTypes(charTypes) {
  const ctx = document.getElementById('chart-char-types').getContext('2d');
  const labels = ['Letras', 'Dígitos', 'Espacios', 'Puntuación'];
  const values = [charTypes.letters, charTypes.digits, charTypes.spaces, charTypes.punctuation];
  const colors = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24'];

  charts.charTypes = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1a1d27',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderLineLengths(dist) {
  const ctx = document.getElementById('chart-line-length').getContext('2d');
  const labels = Object.keys(dist);
  const values = Object.values(dist);

  charts.lineLength = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Líneas',
        data: values,
        backgroundColor: '#818cf8',
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} líneas` } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#2e3250' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#2e3250' }, beginAtZero: true },
      },
    },
  });
}

function renderWordLengths(dist) {
  const ctx = document.getElementById('chart-word-length').getContext('2d');
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  const colors = ['#22d3ee','#34d399','#fbbf24','#f87171','#c084fc'];

  charts.wordLength = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 10, font: { size: 11 } },
        },
      },
      scales: {
        r: {
          ticks: { color: '#94a3b8', backdropColor: 'transparent' },
          grid: { color: '#2e3250' },
        },
      },
    },
  });
}

// ---- Reset ----
function resetDashboard() {
  destroyCharts();
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  dropContent.classList.remove('hidden');
  dropZone.classList.remove('dragover');
  analyzeBtn.disabled = true;
  hideUploadError();
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('upload-section').classList.remove('hidden');
}

// ---- Loading ----
function showLoading() {
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}
