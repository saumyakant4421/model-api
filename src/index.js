const express = require('express');
const cors = require('cors');
const { loadMovies, extractFeatures } = require('./preprocess');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

let movies = [];

async function initialize() {
  movies = await loadMovies();
}

initialize();

function computeSimilarity(features) {
  return (
    features[0] * 0.50 + // genres (increased)
    features[1] * 0.20 + // cast (decreased)
    features[2] * 0.10 + // director (decreased)
    features[3] * 0.20   // keywords (increased)
  );
}

app.get('/recommend', (req, res) => {
  res.json({ message: 'Test recommendation', recommendation: { id: 838209, title: 'Exhuma' } });
});

app.post('/recommend', (req, res) => {
  const { watchlist = [], watched = [] } = req.body;
  if (!Array.isArray(watchlist) || !Array.isArray(watched)) {
    return res.status(400).json({ error: 'watchlist and watched must be arrays' });
  }

  const userPrefs = { genres: [], cast: [], director: '', keywords: [] };
  const userMovies = movies.filter(m => watchlist.includes(m.id) || watched.includes(m.id));
  userMovies.forEach(m => {
    userPrefs.genres.push(...m.genres);
    userPrefs.cast.push(...m.cast);
    userPrefs.director = m.director;
    userPrefs.keywords.push(...m.overview.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  });
  userPrefs.genres = [...new Set(userPrefs.genres)];
  userPrefs.cast = [...new Set(userPrefs.cast)];
  userPrefs.keywords = [...new Set(userPrefs.keywords)];

  const recommendations = movies
    .filter(m => !watched.includes(m.id))
    .map(m => {
      const features = extractFeatures(m, userPrefs);
      const score = computeSimilarity(features);
      return { ...m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(m => ({
      id: m.id,
      title: m.title,
      poster_path: m.poster_path || null,
      vote_average: m.vote_average || 0,
      release_date: m.release_date
    }));

  res.json({ recommendations });
});

app.listen(port, () => {
  console.log(`Model API running on http://localhost:${port}`);
});