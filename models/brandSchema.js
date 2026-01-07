// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema({
  brandName: {
    type: String,
    required: true,
  },
  brandDescription: { 
    type: String, 
    required: true 
  },
  isBlocked: {
    type: Boolean,
    default: false,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

brandSchema.index({ brandName: 1 });
brandSchema.index({ isBlocked: 1, isDeleted: 1 });
brandSchema.index({ createdAt: -1 });

const Brand = mongoose.model("Brand", brandSchema);

// eslint-disable-next-line no-undef
module.exports = Brand;
