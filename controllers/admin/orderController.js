/* eslint-disable no-undef */
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Transaction = require("../../models/transactionSchema");
const Product = require("../../models/productSchema");
const {
  BadRequest,
  NotFound,
  InternalServerError,
} = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } =
  require("../../helpers/constants").ERROR_MESSAGES;
const nodemailer = require("nodemailer");

const sendShippedMail = async (email) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Order Shipped!",
      text: "Your order has been been shipped.",
      html: "<b>Order Shipped</b><br> Your order has been shipped.",
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const loadOrder = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 7;
    const skip = (page - 1) * limit;

    const users = await User.find({
      name: new RegExp(search, "i"),
    });

    const userIds = users.map((user) => user._id);

    const orders = await Order.find({
      $or: [
        { orderId: new RegExp(search, "i") },
        { userId: { $in: userIds } },
        { status: new RegExp(search, "i") },
      ],
    })
      .populate("userId")
      .populate("ordereditems.product")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({
      $or: [
        { orderId: new RegExp(search, "i") },
        { userId: { $in: userIds } },
        { status: new RegExp(search, "i") },
      ],
    });

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      data: orders,
      totalPages,
      currentPage: page,
      activePage: "orders", 
    });
  } catch (error) {
    console.error(error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId })
      .populate("userId")
      .populate("ordereditems.product")
      .exec();

    if (!order) {
      return res.status(NotFound).send("Order not found");
    }

    const userAddresses = await Address.findOne({ userId: order.userId });

    const address = userAddresses
      ? userAddresses.address.find((addr) => addr.isDefault)
      : null;

    const orderDetails = {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      Id: order.userId,
      
      totalPrice: order.originalTotalPrice || order.totalprice || 0,
      discount: order.originalDiscount || order.discount || 0,
      finalAmount: order.originalFinalAmount || order.finalAmount || 0,
      
      originalTotalPrice: order.originalTotalPrice || order.totalprice || 0,
      originalDiscount: order.originalDiscount || order.discount || 0,
      originalFinalAmount: order.originalFinalAmount || order.finalAmount || 0,
      currentTotalPrice: order.currentTotalPrice || 0,
      currentDiscount: order.currentDiscount || 0,
      currentFinalAmount: order.currentFinalAmount || 0,
      totalRefunded: order.totalRefunded || 0,
      
      paymentMethod: order.paymentMethod,
      moneySent: order.moneySent,
      status: order.status,
      couponApplied: order.couponApplied,
      createdOn: order.createdOn,
      address: address,
      orderedItems: order.ordereditems,
      partialRefunds: order.partialRefunds || [],
    };

    res.render("orderDetails", { orderDetails, activePage: "orders" });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status, cancelReason } = req.body;
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ];

    // Validate the status
    if (!validStatuses.includes(status)) {
      return res.status(BadRequest).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find the order
    const order = await Order.findOne({ orderId }).populate("userId");
    if (!order) {
      return res.status(NotFound).json({
        success: false,
        message: "Order not found",
      });
    }

    // Handle refunds for cancelled prepaid orders
    let refundAmount = 0;
    if (
      status === "Cancelled" &&
      order.paymentMethod === "prepaid" &&
      !order.moneySent
    ) {
      refundAmount = order.finalAmount;

      // Find or create user's wallet
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: refundAmount,
        });
      } else {
        wallet.balance += refundAmount;
      }
      await wallet.save();

      // Record the transaction
      const transaction = new Transaction({
        userId: order.userId,
        type: "Order cancelled - admin",
        amount: refundAmount,
        balance: wallet.balance,
        orderId: orderId,
        description: `Full order cancellation by admin`,
      });
      await transaction.save();

      // Mark money as sent
      order.moneySent = true;
    }

    // Update the order status
    order.status = status;

    // Add cancellation reason if provided
    if (status === "Cancelled" && cancelReason) {
      order.cancellationReason = cancelReason;

      // Update all items status to cancelled
      for (const item of order.ordereditems) {
        if (item.status !== "cancelled") {
          item.status = "cancelled";
          item.cancellationReason = cancelReason;
          item.cancelledAt = new Date();
        }
      }
    }

    // Set the delivery timestamp if the status is "Delivered"
    if (status === "Delivered" && !order.firstDeliveredAt) {
      order.firstDeliveredAt = Date.now();
      order.deliveredAt = Date.now();
    }

    const user = await User.findOne({ _id: order.userId });

    if (status === "Shipped") {
      const sendMail = await sendShippedMail(user.email);
      if (sendMail) {
        console.log("Email sent to user");
      }
    }

    if (status === "Cancelled") {
      // Get all items from the order
      const orderItems = order.ordereditems;

      // Update product quantities for each item in the order
      for (const item of orderItems) {
        try {
          const product = await Product.findById(item.product);

          if (product) {
            // Add back the cancelled quantity to product stock
            product.quantity = (product.quantity || 0) + item.quantity;

            // Update status if necessary
            if (product.status === "Out of Stock" && product.quantity > 0) {
              product.status = "Available";
            }

            // Save the updated product
            await product.save();
          }
        } catch (err) {
          console.error(`Error updating product ${item.product} stock:`, err);
        }
      }
    }

    // Save the updated order
    await order.save();

    // Return success response with refund info
    let message = `Order status updated to ${status}`;
    if (status === "Cancelled" && refundAmount > 0) {
      message += `. ₹${refundAmount.toFixed(
        2
      )} has been refunded to user's wallet.`;
    }

    res.json({
      success: true,
      message: message,
      refundAmount: refundAmount,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

// Individual item cancellation for admin
const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId, cancelReason } = req.body;

    if (!cancelReason || cancelReason.trim() === "") {
      return res.status(BadRequest).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    // Find the order with populated product
    const order = await Order.findOne({ orderId }).populate(
      "ordereditems.product",
      "productName"
    );
    if (!order) {
      return res.status(NotFound).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the specific item in the order
    const itemIndex = order.ordereditems.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(NotFound).json({
        success: false,
        message: "Order item not found",
      });
    }

    const item = order.ordereditems[itemIndex];

    // Check if item can be cancelled
    if (item.status === "cancelled") {
      return res.status(BadRequest).json({
        success: false,
        message: "Item is already cancelled",
      });
    }

    // Calculate refund amount
    let refundAmount = 0;
    const itemTotal = item.price * item.quantity;

    if (order.discount > 0 && order.totalprice > 0) {
      const discountPercentage = (order.discount / order.totalprice) * 100;
      const itemDiscount = (itemTotal * discountPercentage) / 100;
      refundAmount = itemTotal - itemDiscount;
    } else {
      refundAmount = itemTotal;
    }

    // Update item status
    item.status = "cancelled";
    item.cancellationReason = cancelReason;
    item.cancelledAt = new Date();

    // Update product stock
    const product = await Product.findById(item.product);
    if (product) {
      product.quantity += item.quantity;
      if (product.status === "Out of Stock" && product.quantity > 0) {
        product.status = "Available";
      }
      await product.save();
    }

    // Recalculate order totals
    order.totalprice -= itemTotal;

    // Adjust discount proportionally
    if (order.discount > 0) {
      const discountPercentage =
        (order.discount / (order.totalprice + itemTotal)) * 100;
      order.discount = (order.totalprice * discountPercentage) / 100;
    }

    order.finalAmount = order.totalprice - order.discount;

    // Handle prepaid refund
    if (order.paymentMethod === "prepaid" && refundAmount > 0) {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: refundAmount,
        });
      } else {
        wallet.balance += refundAmount;
      }

      await wallet.save();

      // Create transaction
      const transaction = new Transaction({
        userId: order.userId,
        type: "Partial refund for cancelled item - admin",
        amount: refundAmount,
        balance: wallet.balance,
        orderId: orderId,
        itemId: itemId,
        productName: item.product?.productName || "Unknown Product",
        description: `Admin cancelled item: ${
          item.product?.productName || "Item"
        }`,
      });

      const savedTransaction = await transaction.save();

      // Add to partialRefunds array
      if (!order.partialRefunds) order.partialRefunds = [];
      order.partialRefunds.push({
        itemId: itemId,
        amount: refundAmount,
        refundedAt: new Date(),
        transactionId: savedTransaction._id,
        reason: cancelReason,
      });
      order.moneySent = true;
    }

    // Check if all items are cancelled
    const remainingItems = order.ordereditems.filter(
      (item) => item.status !== "cancelled"
    );

    if (remainingItems.length === 0) {
      order.status = "Cancelled";
      order.cancellationReason = "All items cancelled by admin";

      // Refund any remaining amount for prepaid
      if (order.paymentMethod === "prepaid" && order.finalAmount > 0) {
        let wallet = await Wallet.findOne({ userId: order.userId });

        if (!wallet) {
          wallet = new Wallet({
            userId: order.userId,
            balance: order.finalAmount,
          });
        } else {
          wallet.balance += order.finalAmount;
        }

        await wallet.save();

        const transaction = new Transaction({
          userId: order.userId,
          type: "Full order cancellation refund - admin",
          amount: order.finalAmount,
          balance: wallet.balance,
          orderId: orderId,
          description: `All items cancelled by admin`,
        });

        await transaction.save();
        order.moneySent = true;
      }
    }

    await order.save();

    // Response
    let message = `Item "${
      item.product?.productName || "Item"
    }" cancelled successfully`;
    if (order.paymentMethod === "prepaid" && refundAmount > 0) {
      message += `. ₹${refundAmount.toFixed(
        2
      )} has been refunded to user's wallet.`;
    }

    res.json({
      success: true,
      message: message,
      refundAmount: refundAmount,
      orderTotal: order.finalAmount,
      remainingItems: remainingItems.length,
    });
  } catch (error) {
    console.error("Error cancelling order item:", error);
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

const sendMoneyToWallet = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId }).populate("userId");

    if (!order) {
      return res.status(NotFound).send("Order not found");
    }

    if (
      ((order.status === "Cancelled" && order.paymentMethod === "prepaid") ||
        order.paymentMethod === "wallet") &&
      !order.moneySent
    ) {
      // Update the order's moneySent status
      order.moneySent = true;
      await order.save();

      // Find the user's wallet
      let wallet = await Wallet.findOne({ userId: order.userId._id });

      if (!wallet) {
        // If no wallet exists, create a new one
        wallet = new Wallet({
          userId: order.userId._id,
          balance: order.finalAmount,
        });
        await wallet.save();
      } else {
        // Add the order's finalAmount to the wallet balance
        wallet.balance += order.finalAmount;
        await wallet.save();
      }

      const transaction = new Transaction({
        userId: order.userId._id,
        type: "credit - admin manual",
        amount: order.finalAmount,
        balance: wallet.balance,
        orderId: orderId,
        description: "Manual refund by admin",
      });

      await transaction.save();

      res.json({
        success: true,
        message: `₹${order.finalAmount} has been sent to the user's wallet.`,
      });
    } else {
      return res.status(BadRequest).json({
        success: false,
        message: "Order is not eligible for money transfer.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  loadOrder,
  viewOrderDetails,
  updateOrderStatus,
  cancelOrderItem,
  sendMoneyToWallet,
};
