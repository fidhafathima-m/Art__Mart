// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
const { Schema } = mongoose;
// eslint-disable-next-line no-undef
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ordereditems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      returnStatus: {
        type: String,
        enum: ["Not Requested", "Requested", "Returned"],
        default: "Not Requested",
      },
      returnReason: {
        type: String,
        required: false,
      }, // Reason for return
    },
  ],
  totalprice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "Address",
    required: true,
  },
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Order Placed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
      "Payment Pending",
    ],
  },
  createdOn: {
    type: Date,
    required: true,
    default: Date.now,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    enum: ["prepaid", "COD", "wallet"],
    required: true,
  },
  moneySent: {
    type: Boolean,
    default: false,
  },
  deliveredAt: {
    type: Date,
    required: false,
  },
  firstDeliveredAt: {
    type: Date,
    required: false,
  },
  cancellationReason: {
    type: String,
    required: false,
  },
});

const Order = mongoose.model("Order", orderSchema);
// eslint-disable-next-line no-undef
module.exports = Order;
