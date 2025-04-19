const fs = require('fs');
const csv = require('csv-parser');

async function loadMovies() {
  const movies = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream('data/movies.csv')
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Safely parse JSON columns
          row.genres = safeParseJSON(row.genres, row.id, 'genres');
          row.cast = safeParseJSON(row.cast, row.id, 'cast');
          row.id = parseInt(row.id);
          // Validate required fields
          if (row.genres && row.cast && row.id) {
            movies.push(row);
          } else {
            console.warn(`Skipping row ${row.id}: Missing or invalid data`);
          }
        } catch (e) {
          console.error(`Error parsing row ${row.id}: ${e.message}`);
        }
      })
      .on('end', () => {
        console.log(`Processed ${movies.length} movies`);
        resolve(movies);
      })
      .on('error', (e) => {
        reject(e);
      });
  });
}

function safeParseJSON(value, rowId, field) {
  if (!value) {
    console.warn(`Empty ${field} in row ${rowId}`);
    return [];
  }
  try {
    // Remove problematic characters or fix common issues
    value = value.replace(/\\(?![\\"])/g, '\\\\'); // Escape unescaped backslashes
    return JSON.parse(value);
  } catch (e) {
    console.error(`Invalid ${field} in row ${rowId}: ${value} - ${e.message}`);
    return [];
  }
}

function extractFeatures(movie, userPrefs) {
  // Ensure genres and cast are arrays
  const genres = Array.isArray(movie.genres) ? movie.genres : [];
  const cast = Array.isArray(movie.cast) ? movie.cast : [];
  return [...genres, ...cast].map(v => userPrefs.genres.includes(v) || userPrefs.cast.includes(v) ? 1 : 0);
}

module.exports = { loadMovies, extractFeatures };