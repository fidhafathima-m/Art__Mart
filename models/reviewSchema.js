// eslint-disable-next-line no-undef
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  review_text: {
    type: String,
    required: true,
  },
  review_date: {
    type: Date,
    default: Date.now,
  },
  // helpful_votes: {
  //     type: Number,
  //     default: 0
  // },
  // images: [String],
  verified_purchase: {
    type: Boolean,
    default: true,
  },
});

reviewSchema.index({ product_id: 1, created_at: -1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ product_id: 1, rating: 1 });

const Review = mongoose.model("Review", reviewSchema);
// eslint-disable-next-line no-undef
module.exports = Review;
