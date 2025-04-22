const tf = require('@tensorflow/tfjs-node');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

let model;
let movies;

// Load model
async function loadModel() {
    try {
        const modelPath = 'file://' + path.join(__dirname, 'tfjs_model', 'model.json');
        model = await tf.loadLayersModel(modelPath);
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Model load error:', error);
        process.exit(1);
    }
}

// Load movies
async function loadMovies() {
    try {
        const moviesData = await fs.readFile('movies.csv', 'utf-8');
        movies = moviesData.split('\n').slice(1).map(row => {
            const [id, title, genres, overview, cast, director] = row.split(',').map(s => s.trim());
            return { id, title, genres, overview, cast, director };
        }).filter(m => m.id && m.title);
        console.log(`Movies loaded: ${movies.length}`);
    } catch (error) {
        console.error('Error loading movies:', error);
        movies = [];
    }
}

// Initialize server
async function startServer() {
    await loadModel();
    await loadMovies();
    console.log(`Processed ${movies.length} movies`);

    app.get('/recommend', async (req, res) => {
        try {
            const features = tf.zeros([1, model.inputs[0].shape[1]]);
            const prediction = model.predict(features);
            const score = await prediction.data();
            res.json({ message: 'Prediction', score: score[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer();