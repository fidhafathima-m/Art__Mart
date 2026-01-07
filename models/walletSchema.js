// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  lastTransactionDate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

walletSchema.index({ userId: 1 });
walletSchema.index({ lastTransactionDate: -1 });

const Wallet = mongoose.model("Wallet", walletSchema);
// eslint-disable-next-line no-undef
module.exports = Wallet;
