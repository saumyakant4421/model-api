const express = require('express');
const cors = require('cors');
const tf = require('@tensorflow/tfjs-node');
const admin = require('firebase-admin');
const axios = require('axios');
const { loadMovies, extractFeatures } = require('./preprocess');

const app = express();

let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  serviceAccount = require('../firebase-adminsdk.json');
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.use(cors({ origin: '*' }));
app.use(express.json());

let model;
(async () => {
  try {
    model = await tf.loadLayersModel('file://./tfjs_model/model.json');
    console.log('Model loaded');
  } catch (e) {
    console.error('Model load error:', e);
  }
})();

let movies;
(async () => {
  try {
    movies = await loadMovies();
    console.log('Movies loaded:', movies.length);
  } catch (e) {
    console.error('Movies load error:', e);
  }
})();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

app.post('/recommend', async (req, res) => {
  if (!model || !movies) {
    return res.status(503).json({ error: 'Service not ready' });
  }
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const userRef = db.collection('users').doc(user_id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : { watchlist: [], watched: [] };
    const watchlist = userData.watchlist?.map(w => w.movieId) || [];
    const watched = userData.watched?.map(w => w.movieId) || [];

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
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

app.get('/recommend/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    // Forward to POST endpoint internally
    const response = await axios.post(`http://${req.headers.host}/recommend`, { user_id });
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

module.exports = app;