const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;

async function createAndSaveModel() {
  // Define a simple sequential model
  const model = tf.sequential();
  
  // Add InputLayer with shape [4]
  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    inputShape: [4] // Matches extractFeatures output
  }));
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

  // Compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError'
  });

  // Generate dummy data for minimal training
  const xs = tf.randomUniform([100, 4]); // 100 samples, 4 features
  const ys = tf.randomUniform([100, 1]); // 100 labels
  await model.fit(xs, ys, { epochs: 5, verbose: 1 });

  // Save the model to tfjs_model/
  await model.save('file://./tfjs_model');
  console.log('Model saved to tfjs_model/');

  // Verify model.json
  const modelJson = await fs.readFile('./tfjs_model/model.json', 'utf8');
  console.log('model.json content:', modelJson);

  xs.dispose();
  ys.dispose();
}

createAndSaveModel().catch(err => console.error('Error:', err));