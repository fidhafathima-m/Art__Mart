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
      status: { 
        type: String, 
        enum: ['ordered', 'shipped', 'delivered', 'cancelled', 'returned', 'return requested'],
        default: 'ordered'
      },
      returnStatus: {
        type: String,
        enum: ["Not Requested", "Requested", "Returned"],
        default: "Not Requested",
      },
      returnReason: {
        type: String,
        required: false,
      },
      cancellationReason: {
        type: String,
        required: false,
      },
      cancelledAt: {
        type: Date,
        required: false,
      },
      originalPrice: {
        type: Number,
        default: 0,
      },
      discountApplied: {
        type: Number,
        default: 0,
      },
      finalPrice: {
        type: Number,
        default: 0,
      },
    },
  ],
  
  // Original totals
  originalTotalPrice: {
    type: Number,
    default: 0
  },
  originalDiscount: {
    type: Number,
    default: 0
  },
  originalFinalAmount: {
    type: Number,
    default: 0
  },
  
  // Current totals
  currentTotalPrice: {
    type: Number,
    default: 0
  },
  currentDiscount: {
    type: Number,
    default: 0
  },
  currentFinalAmount: {
    type: Number,
    default: 0
  },
  
  // Total refunded amount
  totalRefunded: {
    type: Number,
    default: 0
  },
  
  totalprice: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    default: 0
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
  partialRefunds: [{
    itemId: Schema.Types.ObjectId,
    amount: Number,
    refundedAt: Date,
    transactionId: Schema.Types.ObjectId,
    reason: String,
  }],
}, {
  timestamps: true,
});

// pre-save middleware to sync old and new fields
orderSchema.pre('save', function(next) {
  // If this is a new order and original fields are not set, set them from old fields
  if (this.isNew) {
    if (!this.originalTotalPrice && this.totalprice) {
      this.originalTotalPrice = this.totalprice;
    }
    if (!this.originalDiscount && this.discount) {
      this.originalDiscount = this.discount;
    }
    if (!this.originalFinalAmount && this.finalAmount) {
      this.originalFinalAmount = this.finalAmount;
    }
    
    // Set current fields to match original if not set
    if (!this.currentTotalPrice) {
      this.currentTotalPrice = this.originalTotalPrice || this.totalprice || 0;
    }
    if (!this.currentDiscount) {
      this.currentDiscount = this.originalDiscount || this.discount || 0;
    }
    if (!this.currentFinalAmount) {
      this.currentFinalAmount = this.originalFinalAmount || this.finalAmount || 0;
    }
  }
  
  if (!this.totalprice && this.originalTotalPrice) {
    this.totalprice = this.originalTotalPrice;
  }
  if (!this.discount && this.originalDiscount) {
    this.discount = this.originalDiscount;
  }
  if (!this.finalAmount && this.originalFinalAmount) {
    this.finalAmount = this.originalFinalAmount;
  }
  
  next();
});

const Order = mongoose.model("Order", orderSchema);
// eslint-disable-next-line no-undef
module.exports = Order;
