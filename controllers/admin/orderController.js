/* eslint-disable no-undef */
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Transaction = require("../../models/transactionSchema");
const Product = require("../../models/productSchema");
const { BadRequest, NotFound, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;

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
      Id: order.userId,
      totalPrice: order.totalprice,
      discount: order.discount,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      moneySent: order.moneySent,
      status: order.status,
      couponApplied: order.couponApplied,
      createdOn: order.createdOn,
      address: address,
      orderedItems: order.ordereditems,
    };

    res.render("orderDetails", { orderDetails });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
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
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(NotFound).json({
        success: false,
        message: "Order not found",
      });
    }

    // Handle refunds for returned or cancelled prepaid orders
    if (
      (status === "Returned" || status === "Cancelled") &&
      order.paymentMethod === "prepaid" &&
      !order.moneySent
    ) {
      // Find or create user's wallet
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

      // Record the transaction
      const transaction = new Transaction({
        userId: order.userId,
        type: "refund for returned prepaid order",
        amount: order.finalAmount,
        balance: wallet.balance,
      });
      await transaction.save();

      // Mark money as sent
      order.moneySent = true;
    }

    // Update the order status
    order.status = status;

    // Set the delivery timestamp if the status is "Delivered"
    if (status === "Delivered" && !order.firstDeliveredAt) {
      order.firstDeliveredAt = Date.now();
      order.deliveredAt = Date.now();
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
          // Continue with other products even if one fails
        }
      }
    }

    // Save the updated order
    await order.save();

    // Return success response
    res.json({
      success: true,
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
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
        type: "credit",
        amount: order.finalAmount,
        balance: wallet.balance,
      });

      await transaction.save();

      res.json({
        success: true,
        message: "Money has been sent to the user's wallet.",
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
  sendMoneyToWallet,
};
