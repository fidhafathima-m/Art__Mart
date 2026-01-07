/* eslint-disable no-undef */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load all models
const modelsPath = path.join(__dirname, "..", 'models');
fs.readdirSync(modelsPath).forEach(file => {
  require(path.join(modelsPath, file));
});

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    console.log('Creating indexes...');
    
    const models = mongoose.modelNames();
    for (const modelName of models) {
      console.log(`Creating indexes for ${modelName}...`);
      await mongoose.model(modelName).createIndexes();
    }
    
    console.log('All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();