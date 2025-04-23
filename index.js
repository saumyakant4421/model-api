const express = require('express');
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const { loadMovies } = require('./src/preprocess');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

let model;
let movies;

async function loadModel() {
  try {
    const modelJson = JSON.parse(await fs.readFile('./tfjs_model/model.json', 'utf8'));
    model = await tf.loadLayersModel(tf.io.fromMemory(modelJson));
    console.log('Model loaded successfully');
  } catch (error) {
    console.error('Model load error:', error);
    process.exit(1);
  }
}

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
  await loadModel();
  await loadMoviesWrapper();
  console.log(`Processed ${movies.length} movies`);

  app.get('/recommend', async (req, res) => {
    try {
      const features = tf.zeros([1, model.inputs[0].shape[1]]);
      const prediction = model.predict(features);
      const score = prediction.dataSync()[0];
      features.dispose();
      prediction.dispose();
      res.json({ message: 'Test prediction', score });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();