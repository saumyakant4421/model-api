const fs = require('fs');
const csv = require('csv-parser');

async function loadMovies() {
  return new Promise((resolve, reject) => {
    const movies = [];
    fs.createReadStream('data/movies.csv')
      .pipe(csv())
      .on('data', (row) => {
        try {
          const movie = {
            id: parseInt(row.id),
            title: row.title,
            genres: row.genres ? JSON.parse(row.genres) : [],
            overview: row.overview || '',
            cast: row.cast ? JSON.parse(row.cast) : [],
            director: row.director || '',
            release_date: row.release_date || '' // Add release_date
          };
          if (movie.id && movie.title) {
            movies.push(movie);
          } else {
            console.log('Skipping row, ID:', row.id, row);
          }
        } catch (e) {
          console.log('Skipping row due to error, ID:', row.id, e.message);
        }
      })
      .on('end', () => {
        console.log(`Processed ${movies.length} movies`);
        resolve(movies);
      })
      .on('error', (e) => reject(e));
  });
}

function extractFeatures(movie, userPrefs) {
  const genreMatch = movie.genres.some(g => userPrefs.genres.includes(g)) ? 1 : 0;
  const castMatch = movie.cast.some(c => userPrefs.cast.includes(c)) ? 1 : 0;
  const directorMatch = movie.director === userPrefs.director ? 1 : 0;
  const keywordMatch = movie.overview.toLowerCase().split(/\s+/).some(w => userPrefs.keywords.includes(w)) ? 1 : 0;
  return [genreMatch, castMatch, directorMatch, keywordMatch];
}

module.exports = { loadMovies, extractFeatures };