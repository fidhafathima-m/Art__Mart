// eslint-disable-next-line no-undef
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
  usedBy: {
    type: [mongoose.Schema.Types.ObjectId], 
    ref: "User",
    default: [], 
  },
});

const Coupon = mongoose.model("Coupon", couponSchema);
// eslint-disable-next-line no-undef
module.exports = Coupon;
