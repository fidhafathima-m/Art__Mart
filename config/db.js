// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
// eslint-disable-next-line no-undef, no-unused-vars
const dotenv = require("dotenv").config();

const dbConnect = async () => {
  try {
    // eslint-disable-next-line no-undef
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("DB connected successfully");
  } catch (error) {
    console.log("DB connection error: ", error.message);
    // eslint-disable-next-line no-undef
    process.exit(1);
  }
};

// eslint-disable-next-line no-undef
module.exports = dbConnect;
