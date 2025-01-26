// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema({
  brandName: {
    type: String,
    required: true,
  },
  brandImage: {
    type: String,
    required: true,
  },
  isBlocked: {
    type: String,
    required: true,
  },
  createdAt: {
    type: String,
    required: true,
  },
});

const Brand = mongoose.model("Brand", brandSchema);

// eslint-disable-next-line no-undef
module.exports = Brand;
