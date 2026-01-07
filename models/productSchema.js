// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    highlights: {
      type: [String],
      default: [],
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    productOffer: {
      type: Number,
      default: 0,
    },
    quantity: {
      type: Number,
      default: true,
    },
    productImage: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Available", "Out of Stock", "Discontinued"],
      required: true,
      default: "Available",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  { timestamps: true }
);

productSchema.index({ productName: "text" }); // Text index for search
productSchema.index({ category: 1, isListed: 1, isDeleted: 1 });
productSchema.index({ brand: 1, isListed: 1, isDeleted: 1 });
productSchema.index({ status: 1, isListed: 1 });
productSchema.index({ regularPrice: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ createdAt: -1 }); // For new arrivals
productSchema.index({ updatedAt: -1 }); // For recently updated
productSchema.index({ quantity: 1 }); // For stock management
productSchema.index({ category: 1, brand: 1, status: 1 }); // Compound for product listing
productSchema.index({ isDeleted: 1, isBlocked: 1 }); // For admin queries

const Product = mongoose.model("Product", productSchema);
// eslint-disable-next-line no-undef
module.exports = Product;
