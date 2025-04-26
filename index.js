const express = require('express');
const { loadMovies } = require('./src/preprocess');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

let movies;
async function loadMoviesWrapper() {
  try {
    movies = await loadMovies();
    console.log(`Movies loaded: ${movies.length}`);
  } catch (error) {
    console.error('Error loading movies:', error);
    movies = [];
  }
}

async function startServer() {
  await loadMoviesWrapper();
  console.log(`Processed ${movies.length} movies`);

  app.get('/recommend', async (req, res) => {
    try {
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
}

startServer();