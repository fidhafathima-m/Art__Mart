// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");
// eslint-disable-next-line no-undef
const Address = require("../../models/addressSchema");
// eslint-disable-next-line no-undef
const Cart = require("../../models/cartSchema");
// eslint-disable-next-line no-undef
const Order = require("../../models/orderSchema");
// eslint-disable-next-line no-undef
const Review = require("../../models/reviewSchema");
// eslint-disable-next-line no-undef
const Wishlist = require("../../models/wishlistSchema");
// eslint-disable-next-line no-undef
const Product = require("../../models/productSchema");
// eslint-disable-next-line no-undef
const Wallet = require("../../models/walletSchema");
// eslint-disable-next-line no-undef
const Transaction = require("../../models/transactionSchema");
// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
// eslint-disable-next-line no-undef
const nodemailer = require("nodemailer");
// eslint-disable-next-line no-undef, no-unused-vars
const env = require("dotenv").config();
// eslint-disable-next-line no-undef
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
        // eslint-disable-next-line no-undef
        user: process.env.NODEMAILER_EMAIL,
        // eslint-disable-next-line no-undef
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      // eslint-disable-next-line no-undef
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Your otp is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);
    return true;
  } catch (error) {
    console.log("Error sending mail", error);
    return false;
  }
};

//securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("Error: ", error.message);
    console.error("Error in hashing");
  }
};

const getForgetPass = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    console.log("Error: ", error.message);
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
        console.log("OTP: ", otp);
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
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const forgotPassOtpLoad = async (req, res) => {
  try {
    res.render("forgotPassOtp");
  } catch (error) {
    console.log("error: ", error);
    res.redirect("/pageNotFound");
  }
};

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    // console.log('Received OTP:', otp);
    // console.log('Stored OTP in session:', req.session.otp);

    if (otp === req.session.otp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.status(400).json({ success: false, message: "OTP doesn't match" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occured." });
  }
};

const resendForgetPassOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.otp = otp;
    const email = req.session.email;
    console.log("Resending OTP to mail: ", email);
    const emailSent = sendVeificationMail(email, otp);

    if (emailSent) {
      console.log("Resent OTP: ", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP Resent Successfully" });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const resetPasswordLoad = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    console.log("error: ", error);
    res.redirect("/pageNotFound");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.email;

    console.log("Email in session:", email);

    if (password === confirmPassword) {
      const passwordHash = await securePassword(password);

      await User.updateOne({ email: email }, { password: passwordHash });

      // Send JSON response indicating success
      res.json({ success: true, message: "Password reset successfully." });
    } else {
      res.json({ success: false, message: "Passwords don't match" });
    }
  } catch (error) {
    console.log("Error during password reset:", error);
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
      // console.log("Fetched Addresses:", addresses);
      if (addresses && addresses.length > 0) {
        addresses.forEach((address) => {
          console.log("Address Object:", address);
        });
      } else {
        console.log("No addresses found for this user.");
      }

      const userAddresses = await Address.findOne({ userId: userId });

      if (userAddresses) {
        const defaultAddress = userAddresses.address.find(
          (addr) => addr.isDefault === true
        );

        if (!defaultAddress) {
          console.log("No default address found");
        }

        content = { addresses, defaultAddress };
      } else {
        console.log("No user address found.");
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

const loadChangeEmail = async (req, res) => {
  try {
    const user = req.session.user;

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    res.render("change-email", {
      user: user || null,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.log("Error in changing email", error);
    res.redirect("/userProfile");
  }
};

const changeEmail = async (req, res) => {
  try {
    const user = req.session.user;
    await Cart.findOne({ userId: user });

    const { currentEmail } = req.body;
    const userData = await User.findById(user);

    if (userData.email !== currentEmail) {
      return res.json({
        success: false,
        message: "This is not your current email address.",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVeificationMail(currentEmail, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.userData = req.body;
      req.session.email = currentEmail;

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
  } catch (error) {
    console.log("error", error);
    res.json({
      success: false,
      message: "An unexpected error occurred. Please try again.",
    });
  }
};

const otpPage = async (req, res) => {
  try {
    const userId = req.session.user;
    res.render("change-email-otp", { user: userId });
  } catch (error) {
    console.log("error: ", error);
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const user = req.session.user;
    // console.log('Request body:', req.body);
    // console.log('Session userOtp:', req.session.userOtp);

    const otp = req.body.otp ? req.body.otp.trim() : undefined;
    const sessionOtp = req.session.userOtp
      ? req.session.userOtp.trim()
      : undefined;

    // console.log('Received OTP:', otp);
    // console.log('Session OTP:', sessionOtp);

    // console.log('Is OTP equal?', otp === sessionOtp);
    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    if (!otp || !sessionOtp) {
      console.log("OTP or session OTP not found.");
      return res.render("change-email-otp", {
        message: "OTP not received or session expired",
        userData: req.session.userData,
        activePage: "userProfile",
        cartItems: cartItems,
      });
    }

    if (otp === sessionOtp) {
      // console.log('OTP match successful!');
      req.session.userData = req.body.userData;
      res.json({
        success: true,
        message: "OTP verified successfully",
        redirectUrl: "/profile/new-email",
      });
    } else {
      console.log("OTP mismatch!");
      res.json({
        success: false,
        message: "OTP not matching",
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.redirect("/pageNotFound");
  }
};

const emailResentOtp = async (req, res) => {
  try {
    const email = req.session.email;
    if (!email) {
      return res.json({ success: false, message: "No email found in session" });
    }

    const otp = generateOtp();
    const emailSent = await sendVeificationMail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      res.json({ success: true, message: "OTP resent successfully" });
    } else {
      res.json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error while resending OTP:", error);
    res.json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const loadNewMail = async (req, res) => {
  try {
    const user = req.session.user;

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    res.render("new-email", {
      user: req.session.user || null,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.log("Error in loading", error);
    res.redirect("/pageNotFound");
  }
};

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;

    const existingUser = await User.findOne({ email: newEmail });

    const cart = await Cart.findOne({ userId: userId });
    const cartItems = cart ? cart.items : [];

    if (existingUser) {
      return res.render("new-email", {
        message: "This email is already in use. Please choose a different one.",
        activePage: "userProfile",
        cartItems: cartItems,
        user: userId
      });
    }

    await User.findByIdAndUpdate(userId, { email: newEmail });

    res.redirect("/userProfile");
  } catch (error) {
    console.log("Error in updating mail", error);
    res.redirect("/pageNotFound");
  }
};

const loadEmailPageforPassChange = async (req, res) => {
  try {
    const user = req.session.user;

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];
    res.render("change-pass", {
      user: req.session.user || null,
      activePage: "userProfile",
      cartItems: cartItems,
    });
  } catch (error) {
    console.log("Error in loading", error);
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
  } catch (error) {
    console.log("Error in change password validation:", error);
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
    console.log("error: ", error);
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
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "An error occured, please try again" });
    console.log("Error", error);
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
    res.status(500).send("Error loading addresses");
  }
};

const addAddress = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res
        .status(404)
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
      return res
        .status(400)
        .json({
          success: false,
          message: "All required fields must be filled",
        });
    }

    const addressExists = await Address.findOne({
      "address.pincode": pincode,
      userId: userData._id,
    });

    if (addressExists) {
      return res
        .status(400)
        .json({
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

    res
      .status(200)
      .json({
        success: true,
        message: "Address added successfully",
        newAddress: newAddress,
      });
  } catch (error) {
    console.error("Error in adding address:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred, please try again.",
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

    // console.log('current address: ', currAddress)

    if (!currAddress) {
      console.log("Address not found");
      return res.redirect("/pageNotFound");
    }

    const addressData = currAddress.address.find((item) =>
      item._id.equals(addressId)
    );

    if (!addressData) {
      console.log("Address data not found");
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
      console.log("Address not found");
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    const addressExists = await Address.findOne({
      "address.pincode": data.pincode,
      "address._id": { $ne: addressId },
      userId: user,
    });

    if (addressExists) {
      return res
        .status(400)
        .json({
          success: false,
          message: "This pincode is already associated with another address",
        });
    } else {
      console.log("Pincode is unique, proceeding to update");
    }

    const isDefault = data.isDefault === "on";

    if (isDefault) {
      await Address.updateMany(
        { userId: user, "address.isDefault": true },
        { $set: { "address.$.isDefault": false } }
      );
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
            isDefault: isDefault,
          },
        },
      }
    );

    updated ? console.log("Updated") : console.log("not updated");

    res.json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.log("Error in editing address", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred, please try again.",
      });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;

    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      console.log("Address not found");
      return res
        .status(404)
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
  } catch (error) {
    console.log("Error in deleting address", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred, please try again.",
      });
  }
};

const editAddressInCheckout = async (req, res) => {
  try {
    const data = req.body;
    const addressId = new mongoose.Types.ObjectId(data.addressId);
    console.log("Address ID:", addressId);

    const user = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address ID" });
    }

    console.log("Address ID:", data.addressId);

    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      console.log("Address not found");
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    const addressExists = await Address.findOne({
      "address.pincode": data.pincode,
      "address._id": { $ne: addressId },
      userId: user,
    });

    if (addressExists) {
      return res
        .status(400)
        .json({
          success: false,
          message: "This pincode is already associated with another address",
        });
    } else {
      console.log("Pincode is unique, proceeding to update");
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

    updated ? console.log("Updated") : console.log("not updated");

    res.json({
      success: true,
      message: "Address updated successfully",
      updatedAddress: updated,
    });
  } catch (error) {
    console.log("Error in editing address", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred, please try again.",
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

    console.log("Address: ", address);

    res.render("orderDetail", {
      order,
      user: userId,
      activePage: "profile",
      cartItems: cartItems,
      reviews,
      address,
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

    const order = await Order.findById(orderId);

    if (!order || order.userId.toString() !== userId) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Order not found or you are not authorized to cancel this order.",
        });
    }

    if (order.status !== "Pending" && order.status !== "Processing") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order cannot be canceled at this stage.",
        });
    }

    order.status = "Cancelled";
    await order.save();

    if (order.paymentMethod === "prepaid") {
      return res.json({
        success: true,
        message: `Your order has been cancelled. The prepaid amount of ₹${order.finalAmount} will be credited to your wallet within 24 hours.`,
      });
    }

    if (order.paymentMethod === "wallet") {
      return res.json({
        success: true,
        message: `Your order has been cancelled. The prepaid amount of ₹${order.finalAmount} will be credited to your wallet within 24 hours.`,
      });
    }

    res.json({ success: true, message: "Order has been cancelled." });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res
      .status(500)
      .json({
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
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res
        .status(400)
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
      .status(500)
      .json({ success: false, message: "Error processing the return request" });
  }
};

const cancelReturn = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const returnRequestedItem = order.ordereditems.find(
      (item) => item.returnStatus === "Requested"
    );

    if (!returnRequestedItem) {
      return res
        .status(400)
        .json({
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
    return res.status(500).json({ success: false, message: "Server error" });
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
  } catch (error) {
    console.log(error);
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
  } catch (error) {
    console.log(error);
    // Send an error response as JSON
    res.json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  getForgetPass,
  forgotPassOtpLoad,
  forgotPassValid,
  verifyForgetPassOtp,
  resendForgetPassOtp,
  resetPasswordLoad,
  resetPassword,
  loadUserProfile,
  loadChangeEmail,
  changeEmail,
  otpPage,
  emailResentOtp,
  verifyEmailOtp,
  loadNewMail,
  updateEmail,
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
