/* eslint-disable no-undef */
const mongoose = require("mongoose");
require("dotenv").config();

const dbConnect = async () => {
  try {
    // Make sure you use the environment variable MONGODB_URL
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected DB:", mongoose.connection.db.databaseName);
    console.log("Connected to: ", process.env.MONGODB_URL);
    console.log("DB connected successfully");
  } catch (error) {
    console.log("DB connection error: ", error.message);
    process.exit(1);
  }
};

module.exports = dbConnect;
