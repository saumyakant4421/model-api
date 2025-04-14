const express = require('express');
const cors = require('cors');
const tf = require('@tensorflow/tfjs');
const admin = require('firebase-admin');
const axios = require('axios');
const { loadMovies, extractFeatures } = require('./preprocess');

const app = express();
const port = 8000;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert('./firebaseServiceAccountKey.json')
});
const db = admin.firestore();

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Load model
let model;
(async () => {
  model = await tf.loadLayersModel('file://./tfjs_model/model.json');
  console.log('Model loaded');
})();

// Load movies
let movies;
(async () => {
  movies = await loadMovies();
  console.log('Movies loaded:', movies.length);
})();

// TMDB API
const TMDB_API_KEY = 'your_tmdb_api_key_here'; // Replace with yours
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// API endpoint
app.post('/recommend', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    // Fetch user watchlist/watched from Firebase
    const userRef = db.collection('users').doc(user_id);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : { watchlist: [], watched: [] };
    const watchlist = userData.watchlist?.map(w => w.movieId) || [];
    const watched = userData.watched?.map(w => w.movieId) || [];

    // Extract user preferences (from watched movies)
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
        if (movie.director) userPrefs.director = movie.director; // Simplified
      }
    }
    userPrefs.genres = [...new Set(userPrefs.genres)];
    userPrefs.keywords = [...new Set(userPrefs.keywords)];
    userPrefs.cast = [...new Set(userPrefs.cast)];

    // Filter candidates
    const candidates = movies.filter(m => !watchlist.includes(m.id) && !watched.includes(m.id));

    // Predict scores
    const features = candidates.map(m => extractFeatures(m, userPrefs));
    const X = tf.tensor2d(features);
    const scores = model.predict(X).dataSync();
    X.dispose();

    // Get top 8
    const topIndices = scores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.idx);

    // Fetch TMDB details
    const recommendations = await Promise.all(
      topIndices.map(async idx => {
        const movie = candidates[idx];
        try {
          const response = await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}`, {
            params: { api_key: "1a3bdbe7a3d987b59bad9c963f3d5836" }
          });
          return {
            id: movie.id,
            title: response.data.title,
            poster_path: response.data.poster_path,
            vote_average: response.data.vote_average
          };
        } catch (e) {
          console.error(`Error fetching TMDB for ${movie.id}:`, e.message);
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

app.listen(port, () => {
  console.log(`Recommendation API running on http://localhost:${port}`);
});