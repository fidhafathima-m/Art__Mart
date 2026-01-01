// eslint-disable-next-line no-undef
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      "credit",
      "debit",
      "refund for returned prepaid order",
      "Order cancelled",
      "Partial refund for cancelled item",
      "Full order cancellation refund",
      "Order cancelled - full refund",
      "Wallet payment",
      "Coupon refund",
      "Shipping refund",
      "Tax refund",
    ],
  },
  amount: {
    type: Number,
    required: true,
  },
  balance: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  orderId: {
    type: String,
    required: function () {
      return (
        this.type.includes("order") ||
        this.type.includes("refund") ||
        this.type.includes("cancelled")
      );
    },
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function () {
      return this.type.includes("Partial refund");
    },
  },
  description: {
    type: String,
    required: false,
  },
  productName: {
    type: String,
    required: function () {
      return this.type.includes("Partial refund");
    },
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed",
  },
  partialRefundId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);
// eslint-disable-next-line no-undef
module.exports = Transaction;
