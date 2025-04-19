const app = require('./src/index');
const port = process.env.PORT || 10000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});