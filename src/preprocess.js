const fs = require('fs');
const csv = require('csv-parser');

// Load movies.csv
const loadMovies = () => {
  return new Promise((resolve, reject) => {
    const movies = [];
    fs.createReadStream('data/movies.csv')
      .pipe(csv())
      .on('data', (row) => {
        movies.push({
          id: parseInt(row.id),
          title: row.title,
          overview: row.overview || '',
          genres: JSON.parse(row.genres.replace(/'/g, '"')),
          director: row.director,
          cast: JSON.parse(row.cast.replace(/'/g, '"'))
        });
      })
      .on('end', () => resolve(movies))
      .on('error', reject);
  });
};

// Simple feature extraction
const extractFeatures = (movie, userPrefs = {}) => {
  const features = [];

  // Overview: Count matching keywords (approximate TF-IDF)
  const overviewWords = movie.overview.toLowerCase().split(/\s+/);
  const keywordScore = userPrefs.keywords
    ? userPrefs.keywords.reduce((sum, kw) => sum + (overviewWords.includes(kw.toLowerCase()) ? 1 : 0), 0) / Math.max(overviewWords.length, 1)
    : 0;
  features.push(keywordScore);

  // Genres: Binary match
  const genreScore = movie.genres.reduce((sum, g) => sum + (userPrefs.genres?.includes(g) ? 1 : 0), 0);
  features.push(genreScore);

  // Cast: Binary match
  const castScore = movie.cast.reduce((sum, c) => sum + (userPrefs.cast?.includes(c) ? 1 : 0), 0);
  features.push(castScore);

  // Director: Binary match
  const directorScore = userPrefs.director === movie.director ? 1 : 0;
  features.push(directorScore);

  return features;
};

module.exports = { loadMovies, extractFeatures };