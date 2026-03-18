const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .txt'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

function analyzeText(text) {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  // Word frequency
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Character distribution
  const charTypes = {
    letters: (text.match(/[a-záéíóúüñ]/gi) || []).length,
    digits: (text.match(/\d/g) || []).length,
    spaces: (text.match(/\s/g) || []).length,
    punctuation: (text.match(/[^\w\s]/g) || []).length,
  };

  // Line length distribution
  const lineLengths = nonEmptyLines.map(l => l.length);
  const avgLineLength = lineLengths.length
    ? Math.round(lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length)
    : 0;

  const lengthBuckets = { '1-20': 0, '21-50': 0, '51-100': 0, '101-200': 0, '200+': 0 };
  lineLengths.forEach(len => {
    if (len <= 20) lengthBuckets['1-20']++;
    else if (len <= 50) lengthBuckets['21-50']++;
    else if (len <= 100) lengthBuckets['51-100']++;
    else if (len <= 200) lengthBuckets['101-200']++;
    else lengthBuckets['200+']++;
  });

  // Word length distribution
  const wordLengthBuckets = { '1-3': 0, '4-6': 0, '7-9': 0, '10-12': 0, '13+': 0 };
  words.forEach(w => {
    const len = w.length;
    if (len <= 3) wordLengthBuckets['1-3']++;
    else if (len <= 6) wordLengthBuckets['4-6']++;
    else if (len <= 9) wordLengthBuckets['7-9']++;
    else if (len <= 12) wordLengthBuckets['10-12']++;
    else wordLengthBuckets['13+']++;
  });

  // Words per line
  const wordsPerLine = nonEmptyLines.map(line =>
    line.trim().split(/\s+/).filter(w => w.length > 0).length
  );

  return {
    summary: {
      totalChars: text.length,
      totalLines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      totalWords: words.length,
      uniqueWords: Object.keys(wordFreq).length,
      avgLineLength,
      avgWordsPerLine: wordsPerLine.length
        ? Math.round(wordsPerLine.reduce((a, b) => a + b, 0) / wordsPerLine.length)
        : 0,
    },
    topWords,
    charTypes,
    lineLengthDistribution: lengthBuckets,
    wordLengthDistribution: wordLengthBuckets,
  };
}

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const text = req.file.buffer.toString('utf-8');

  if (text.trim().length === 0) {
    return res.status(400).json({ error: 'El archivo está vacío' });
  }

  const analysis = analyzeText(text);

  res.json({
    filename: req.file.originalname,
    size: req.file.size,
    ...analysis,
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
