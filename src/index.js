const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const axios = require('axios');
const { loadMovies, extractFeatures } = require('./preprocess');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());

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

// Compute similarity score without a model
function computeSimilarity(features) {
  // Features: [genreMatch, castMatch, directorMatch, keywordMatch]
  // Weighted sum: genre (40%), cast (30%), director (20%), keywords (10%)
  return (
    features[0] * 0.4 +
    features[1] * 0.3 +
    features[2] * 0.2 +
    features[3] * 0.1
  );
}

app.post('/recommend', async (req, res) => {
  if (!moviesLoaded) {
    return res.status(503).json({ error: 'Service not ready: Movies not loaded' });
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

    const scoredMovies = candidates.map(movie => {
      const features = extractFeatures(movie, userPrefs);
      const score = computeSimilarity(features);
      return { movie, score };
    });

    const topMovies = scoredMovies
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.movie);

    const recommendations = await Promise.all(
      topMovies.map(async movie => {
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
  if (!moviesLoaded) {
    return res.status(503).json({ error: 'Service not ready: Movies not loaded' });
  }
  try {
    // Return a random movie for testing
    const randomIndex = Math.floor(Math.random() * movies.length);
    const movie = movies[randomIndex];
    res.json({
      message: 'Test recommendation',
      recommendation: {
        id: movie.id,
        title: movie.title
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;