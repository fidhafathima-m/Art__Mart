const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  createdOn: {
    type: Date,
    required: true,
    default: Date.now,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  offerPrice: {
    type: Number,
    required: true,
  },
  minPurchaseAmount: {
    type: Number,
    required: true,
  },
  isList: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
