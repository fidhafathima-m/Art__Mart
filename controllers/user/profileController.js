/* eslint-disable no-undef */
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Review = require("../../models/reviewSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const Transaction = require("../../models/transactionSchema");
const { OK, BadRequest, NotFound, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();
const bcrypt = require("bcrypt");

// generate OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// verification mail
const sendVeificationMail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Your otp is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`,
    };

    await transporter.sendMail(mailOptions);
    return true;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }
};

//securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    console.error("Error in hashing");
  }
};

const getForgetPass = async (req, res) => {
  try {
    res.render("forgot-password");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const forgotPassValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVeificationMail(email, otp);

      if (emailSent) {
        req.session.otp = otp;
        req.session.email = email;
        return res.json({ success: true });
      } else {
        return res.json({
          success: false,
          message: "Failed to send OTP, please try again",
        });
      }
    } else {
      return res.json({
        success: false,
        message: "User  with this email does not exist.",
      });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(InternalServerError)
      .json({ success: false, message: INTERNAL_SERVER_ERROR});
  }
};

const forgotPassOtpLoad = async (req, res) => {
  try {
    res.render("forgotPassOtp");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.otp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.status(BadRequest).json({ success: false, message: "OTP doesn't match" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const resendForgetPassOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.otp = otp;
    const email = req.session.email;
    const emailSent = sendVeificationMail(email, otp);

    if (emailSent) {
      res
        .status(OK)
        .json({ success: true, message: "OTP Resent Successfully" });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const resetPasswordLoad = async (req, res) => {
  try {
    const user = req.session.user;
    res.render("reset-password", {user});
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;

    if (password === confirmPassword) {
      const passwordHash = await securePassword(password);

      await User.updateOne({ email: email }, { password: passwordHash });

      // Send JSON response indicating success
      res.json({ success: true, message: "Password reset successfully." });
    } else {
      res.json({ success: false, message: "Passwords don't match" });
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

const loadUserProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res.redirect("/login");
    }

    const section = req.query.section || "dashboard";
    let content = {};

    if (section === "addresses") {
      const addresses = await Address.find({ userId });

      const userAddresses = await Address.findOne({ userId: userId });

      if (userAddresses) {
        const defaultAddress = userAddresses.address.find(
          (addr) => addr.isDefault === true
        );

        content = { addresses, defaultAddress };
      } else {
        content = { addresses: [], defaultAddress: null };
      }
    } else if (section === "orders") {
      const page = parseInt(req.query.page) || 1; // Get the current page from the query parameters
      const limit = 3; // Set the number of orders to display per page
      const skip = (page - 1) * limit; // Calculate the number of orders to skip

      // Fetch the total number of orders for the user
      const totalOrders = await Order.countDocuments({ userId });

      // Fetch the orders for the user with pagination
      const orders = await Order.find({ userId })
        .populate("ordereditems.product", "productName productImage") // Populate product details
        .sort({ createdOn: -1 }) // Sort orders by creation date in descending order
        .skip(skip) // Skip the calculated number of orders
        .limit(limit) // Limit the number of orders returned
        .exec();

      const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

      // Prepare the content to be sent to the client
      content = { orders, totalPages, totalOrders, currentPage: page };
    } else if (section === "wishlist") {
      // Fetch Wishlist Logic
      const wishlist = await Wishlist.findOne({ userId }).populate({
        path: "products.productId",
        model: Product,
      });

      if (!wishlist) {
        content = { wishlistItems: [] };
      } else {
        const sortedWishlistItems = wishlist.products.sort(
          (a, b) => b.addedOn - a.addedOn
        );

        const wishlistItems = sortedWishlistItems.map((item) => ({
          id: item.productId._id,
          productName: item.productId.productName,
          productImage: item.productId.productImage,
          salePrice: item.productId.salePrice,
          productOffer: item.productId.productOffer,
          regularPrice: item.productId.regularPrice,
          productId: item.productId._id,
        }));
        content = { wishlistItems };
      }
    } else if (section === "wallet") {
      const page = parseInt(req.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;

      const wallet = await Wallet.findOne({ userId: userId });
      const totalTransactions = await Transaction.countDocuments({
        userId: userId,
      });
      const transactions = await Transaction.find({ userId: userId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit);

      const totalPages = Math.ceil(totalTransactions / limit);

      content = {
        wallet,
        transactions,
        totalPages,
        totalTransactions,
        currentPage: page,
      };
    } else if (section === "referrals") {
      const usersWhoUsedReferral = await User.find({
        _id: userId,
        redeemed: true,
      }).populate("redeemedUsers", "name email");
      content = { usersWhoUsedReferral };
    } else {
      content = { userProfile: true };
    }
    const cart = await Cart.findOne({ userId: userId });
    const cartItems = cart ? cart.items : [];

    res.render("profile", {
      user: userData,
      ...content,
      section,
      currentPage: section,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.error("Error loading user profile:", error);
    res.redirect("/pageNotFound");
  }
};



const loadEmailPageforPassChange = async (req, res) => {
  try {
    const user = await User.findById(req.session.user).select('name email');

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];
    res.render("change-pass", {
      user: user || null,
      activePage: "userProfile",
      cartItems: cartItems,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const changePassValid = async (req, res) => {
  try {
    const user = req.session.user;
    await Cart.findOne({ userId: user });

    const { newEmail } = req.body;
    const userData = await User.findById(user);

    if (userData.email !== newEmail) {
      return res.json({
        success: false,
        message: "This is not your current email address.",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVeificationMail(newEmail, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.userData = req.body;
      req.session.email = newEmail;

      return res.json({
        success: true,
        message: "OTP sent successfully. Please check your email.",
      });
    } else {
      return res.json({
        success: false,
        message: "Error sending OTP. Please try again later.",
      });
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({
      success: false,
      message: "An unexpected error occurred. Please try again.",
    });
  }
};

const passOtpPage = async (req, res) => {
  try {
    const userId = req.session.user;
    res.render("change-pass-otp", { user: userId });
  } catch (error) {
    console.error(error);
  }
};

const verifyChangePassOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOtp) {
      req.session.email = req.session.userData.newEmail;
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ success: false, message: "OTP not matching" });
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res
      .status(InternalServerError)
      .json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const loadAddAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    res.render("add-address", {
      user: user,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.error("Error loading:", error);
    res.status(InternalServerError).send("Error loading addresses");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res
        .status(NotFound)
        .json({ success: false, message: "User not found" });
    }

    const {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
      isDefault,
    } = req.body;

    if (!addressType || !name || !city || !state || !pincode || !phone) {
      return res.status(BadRequest).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const addressExists = await Address.findOne({
      "address.pincode": pincode,
      userId: userData._id,
    });

    if (addressExists) {
      return res.status(BadRequest).json({
        success: false,
        message: "This location address already exists",
      });
    }

    const newAddress = {
      addressType,
      name,
      city,
      landMark: landMark || "",
      state,
      pincode,
      phone,
      altPhone,
      isDefault: isDefault === "on",
    };

    if (newAddress.isDefault) {
      await Address.updateMany(
        { userId: userData._id, "address.isDefault": true },
        { $set: { "address.$.isDefault": false } }
      );
    }

    const userAddress = await Address.findOne({ userId: userData._id });

    if (!userAddress) {
      const newAddressDoc = new Address({
        userId: userData._id,
        address: [newAddress],
      });
      await newAddressDoc.save();
    } else {
      userAddress.address.push(newAddress);
      await userAddress.save();
    }

    res.status(OK).json({
      success: true,
      message: "Address added successfully",
      newAddress: newAddress,
    });
  } catch (error) {
    console.error("Error in adding address:", error);
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    const currAddress = await Address.findOne({
      "address._id": addressId,
    });

    if (!currAddress) {
      return res.redirect("/pageNotFound");
    }

    const addressData = currAddress.address.find((item) =>
      item._id.equals(addressId)
    );

    if (!addressData) {
      return res.redirect("/pageNotFound");
    }
    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    res.render("edit-address", {
      address: addressData,
      user: user,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.error("Error loading address:", error);
    res.redirect("/pageNotFound");
  }
};

const editAddress = async (req, res) => {
  try {
    const data = req.body;
    const addressId = req.query.id;
    const user = req.session.user;

    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Address not found" });
    }

    const addressExists = await Address.findOne({
      "address.pincode": data.pincode,
      "address._id": { $ne: addressId },
      userId: user,
    });

    if (addressExists) {
      return res.status(BadRequest).json({
        success: false,
        message: "This pincode is already associated with another address",
      });
    }
    const isDefault = data.isDefault === "on";

    if (isDefault) {
      await Address.updateMany(
        { userId: user, "address.isDefault": true },
        { $set: { "address.$.isDefault": false } }
      );
    }

    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$": {
            _id: addressId,
            addressType: data.addressType,
            name: data.name,
            city: data.city,
            landMark: data.landMark,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone,
            altPhone: data.altPhone,
            isDefault: isDefault,
          },
        },
      }
    );

    res.json({ success: true, message: "Address updated successfully" });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;

    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Address not found" });
    }

    await Address.updateOne(
      { "address._id": addressId },
      {
        $pull: {
          address: {
            _id: addressId,
          },
        },
      }
    );

    res.json({ success: true, message: "Address deleted successfully" });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

const editAddressInCheckout = async (req, res) => {
  try {
    const data = req.body;
    const addressId = new mongoose.Types.ObjectId(data.addressId);

    const user = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(BadRequest)
        .json({ success: false, message: "Invalid address ID" });
    }

    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Address not found" });
    }

    const addressExists = await Address.findOne({
      "address.pincode": data.pincode,
      "address._id": { $ne: addressId },
      userId: user,
    });

    if (addressExists) {
      return res.status(BadRequest).json({
        success: false,
        message: "This pincode is already associated with another address",
      });
    }

    const updated = await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$": {
            _id: addressId,
            addressType: data.addressType,
            name: data.name,
            city: data.city,
            landMark: data.landMark,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone,
            altPhone: data.altPhone,
            isDefault: true,
          },
        },
      }
    );

    res.json({
      success: true,
      message: "Address updated successfully",
      updatedAddress: updated,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(InternalServerError).json({
      success: false,
      message: INTERNAL_SERVER_ERROR,
    });
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    const order = await Order.findOne({ orderId: orderId })
      .populate(
        "ordereditems.product",
        "productName productImage salePrice reviews"
      )
      .exec();

    if (!order || order.userId.toString() !== userId) {
      return res.redirect("/profile/userProfile?section=orders");
    }

    const cart = await Cart.findOne({ userId: userId });
    const cartItems = cart ? cart.items : [];

    const reviews = [];
    for (let item of order.ordereditems) {
      const existingReview = await Review.findOne({
        product_id: item.product._id,
        user_id: userId,
      });

      reviews.push({
        productId: item.product._id,
        existingReview: existingReview ? true : false,
      });
    }

    const userAddresses = await Address.findOne({ userId: userId });

    const address = userAddresses
      ? userAddresses.address.find((addr) => addr.isDefault)
      : null;

    res.render("orderDetail", {
      order,
      user: userId,
      activePage: "profile",
      cartItems: cartItems,
      reviews,
      address,
      paymentMethod: order.paymentMethod,
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.redirect("/pageNotFound");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;
    const { cancelReason } = req.body; 

    // Populate the product details in ordereditems
    const order = await Order.findById(orderId).populate(
      "ordereditems.product"
    );

    if (!order || order.userId.toString() !== userId) {
      return res.status(NotFound).json({
        success: false,
        message:
          "Order not found or you are not authorized to cancel this order.",
      });
    }

    if (order.status !== "Order Placed" && order.status !== "Processing") {
      return res.status(BadRequest).json({
        success: false,
        message: "Order cannot be canceled at this stage.",
      });
    }

    order.cancellationReason = cancelReason;

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

    // Update order status
    order.status = "Cancelled";
    await order.save();

    if (order.paymentMethod === "prepaid" || order.paymentMethod === "wallet") {
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

      // Create a transaction for the refund
      const transaction = new Transaction({
        userId: order.userId._id,
        type: "Order cancelled",
        amount: order.finalAmount,
        balance: wallet.balance,
      });

      await transaction.save();

      order.moneySent = true;
      await order.save();

      return res.json({
        success: true,
        message: `Your order has been cancelled. The prepaid amount of ₹${order.finalAmount} has been refunded to your wallet.`,
      });
    }

    res.json({
      success: true,
      message: "Order has been cancelled.",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(InternalServerError).json({
      success: false,
      message: "An error occurred while cancelling the order.",
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { returnReason } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res
        .status(BadRequest)
        .json({ success: false, message: "This order cannot be returned" });
    }

    order.status = "Return Request";
    order.ordereditems.forEach((item) => {
      item.returnStatus = "Requested";
      item.returnReason = returnReason;
    });

    await order.save();

    res.json({
      success: true,
      message: "Return request successfully submitted",
    });
  } catch (error) {
    console.error(error);
    res
      .status(InternalServerError)
      .json({ success: false, message: "Error processing the return request" });
  }
};

const cancelReturn = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Order not found" });
    }

    const returnRequestedItem = order.ordereditems.find(
      (item) => item.returnStatus === "Requested"
    );

    if (!returnRequestedItem) {
      return res.status(BadRequest).json({
        success: false,
        message: "No active return request to cancel",
      });
    }

    order.ordereditems.forEach((item) => {
      if (item.returnStatus === "Requested") {
        item.returnStatus = "Not Requested";
      }
    });

    order.status = "Delivered";

    await order.save();

    return res.json({
      success: true,
      message: "Return request cancelled successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const loadEditProfile = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];
    res.render("edit-profile", {
      user: userData,
      activePage: "profile",
      currentPage: "dashboard",
      cartItems: cartItems,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const editProfile = async (req, res) => {
  try {
    const { name, phone } = req.body; // Extract the new values from the form

    const user = req.session.user;
    const userData = await User.findById(user);

    // Update the user's profile with the new data
    userData.name = name;
    userData.phone = phone;

    // Save the updated user data in the database
    await userData.save();

    // Send a success response as JSON
    res.json({ success: true, message: "Profile updated successfully!" });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Send an error response as JSON
    res.json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

module.exports = {
  getForgetPass,
  forgotPassOtpLoad,
  forgotPassValid,
  verifyForgetPassOtp,
  resendForgetPassOtp,
  resetPasswordLoad,
  resetPassword,
  loadUserProfile,
  loadEmailPageforPassChange,
  changePassValid,
  passOtpPage,
  verifyChangePassOtp,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  editAddressInCheckout,
  viewOrderDetails,
  cancelOrder,
  returnOrder,
  cancelReturn,
  loadEditProfile,
  editProfile,
};
