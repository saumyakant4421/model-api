const express = require('express');
const cors = require('cors');
const tf = require('@tensorflow/tfjs');
const axios = require('axios');
const { loadMovies, extractFeatures } = require('./preprocess');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

let model;
let modelLoaded = false;
(async () => {
  try {
    model = await tf.loadLayersModel('file://./tfjs_model/model.json');
    modelLoaded = true;
    console.log('Model loaded');
  } catch (e) {
    console.error('Model load error:', e);
  }
})();

let movies;
let moviesLoaded = false;
(async () => {
  try {
    movies = await loadMovies();
    moviesLoaded = true;
    console.log('Movies loaded:', movies.length);
  } catch (e) {
    console.error('Movies load error:', e);
  }
})();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

app.post('/recommend', async (req, res) => {
  if (!modelLoaded || !moviesLoaded) {
    return res.status(503).json({ error: 'Service not ready: Model or movies not loaded' });
  }
  try {
    const { watchlist = [], watched = [] } = req.body;
    if (!Array.isArray(watchlist) || !Array.isArray(watched)) {
      return res.status(400).json({ error: 'watchlist and watched must be arrays' });
    }

    const userPrefs = {
      genres: [],
      keywords: [],
      cast: [],
      director: ''
    };
    for (const movieId of watched) {
      const movie = movies.find(m => m.id === movieId);
      if (movie) {
        userPrefs.genres.push(...movie.genres);
        userPrefs.keywords.push(...movie.overview.toLowerCase().split(/\s+/).filter(w => w.length > 4));
        userPrefs.cast.push(...movie.cast);
        if (movie.director) userPrefs.director = movie.director;
      }
    }
    userPrefs.genres = [...new Set(userPrefs.genres)];
    userPrefs.keywords = [...new Set(userPrefs.keywords)];
    userPrefs.cast = [...new Set(userPrefs.cast)];

    const candidates = movies.filter(m => !watchlist.includes(m.id) && !watched.includes(m.id));
    if (!candidates.length) {
      return res.json({ recommendations: [] });
    }

    const features = candidates.map(m => extractFeatures(m, userPrefs));
    const X = tf.tensor2d(features);
    const scores = model.predict(X).dataSync();
    X.dispose();

    const topIndices = scores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.idx);

    const recommendations = await Promise.all(
      topIndices.map(async idx => {
        const movie = candidates[idx];
        try {
          if (!TMDB_API_KEY) throw new Error('No TMDB API key');
          const response = await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}`, {
            params: { api_key: TMDB_API_KEY }
          });
          return {
            id: movie.id,
            title: response.data.title,
            poster_path: response.data.poster_path,
            vote_average: response.data.vote_average
          };
        } catch {
          return { id: movie.id, title: movie.title };
        }
      })
    );

    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

app.get('/recommend', (req, res) => {
  res.status(400).json({ error: 'Use POST /recommend with watchlist and watched arrays' });
});

module.exports = app;