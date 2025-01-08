const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require('../../models/cartSchema');
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
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

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your otp is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.log("Error sending mail", error);
    console.error("Stack Trace:", error.stack);
    throw new Error("Failed to send verification email");
  }
};

// securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error in hashing");
    throw new Error("Failed to secure password");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    console.log("Error loading 404 page", error);
    res.status(500).send("Internal Server Error: Unable to load page.");
  }
};

const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user; // Check if user is in session
    const categories = await Category.find({ isListed: true });

    let productsData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      // quantity: { $gt: 0 }
    }) // Optimize fields

    // Sort products by creation date
    productsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productsData = productsData.slice(0, 4); // Limit to 4 products

    if (productsData.length === 0) {
      console.log("No products found");
      return res.render("home", {
        user: req.session.user || null,  // Pass user data or null if user is not logged in
        product: [],
        message: "No products available at the moment"
      });
    }

    // If user is logged in, fetch user data, otherwise set it to null
    const userData = user ? await User.findOne({ _id: user }) : null;

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

    // Render the page with user data if the user is logged in, or pass null if not logged in
    if (userData) {
      res.locals.user = userData; // Store the user data in locals for global access
      res.render("home", { 
        user: userData, 
        product: productsData,
        cartItems: cartItems
      });
    } else {
      res.render("home", { product: productsData, user: null });  // Pass null if user is not logged in
    }
  } catch (error) {
    console.log("Error loading home page", error.message);
    res
      .status(500)
      .send(
        `Internal Server Error: Unable to load home page. Error: ${error.message}`
      );
  }
};

const loadSignUp = async (req, res) => {
  try {
    res.render("signup");
  } catch (error) {
    console.log("Error loading sign-up page", error);
    res.status(500).send("Internal Server Error: Unable to load sign-up page.");
  }
};

const signUp = async (req, res) => {
  try {
    const { name, phone, email, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email exists" });
    }

    const otp = generateOtp();
    const sendOtp = sendVeificationMail(email, otp);

    if (!sendOtp) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render("verify-otp");
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("Error during signup", error);
    res.status(500).send("Internal Server Error: Failed to complete signup.");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    console.log("Stored OTP in session:", req.session.userOtp);

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHashed = await securePassword(user.password);

      const saveUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHashed,
      });

      await saveUser.save();
      req.session.user = saveUser._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please try again." });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error: Unable to verify OTP.",
      });
  }
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData || !req.session.userData.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }

    const { email } = req.session.userData;

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVeificationMail(email, otp);

    if (emailSent) {
      console.log("Resent OTP:", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res
        .status(400)
        .json({
          success: false,
          message: "Failed to resend OTP, please try again",
        });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error: Failed to resend OTP",
      });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log("Error loading login page", error);
    res.status(500).send("Internal Server Error: Unable to load login page.");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }

    if (findUser.isBlocked) {
      return res.render("login", { message: "User blocked by admin" });
    }

    if (!findUser.password) {
      return res.render("login", {
        message: "Password is missing or corrupted",
      });
    }

    const passMatch = await bcrypt.compare(password, findUser.password);

    if (!passMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = findUser._id;
    req.session.save((err) => {
      if (err) {
        console.log("Session save error", err);
      }
      console.log("Session saved after login");
    });
    // console.log('Session after login:', req.session);
    res.redirect("/");
  } catch (error) {
    console.error("Login error", error);
    res
      .status(500)
      .render("login", {
        message: "Internal Server Error: Login failed. Please try again later.",
      });
  }
};

const loadShopping = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({
      isListed: true,
      isDeleted: false,
    });
    const categoryIds = categories.map((category) => category._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const products = await Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      // quantity: { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      // quantity: { $gt: 0 }
    });
    const totalPages = Math.ceil(totalProducts / limit);

    const categoryWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

    res.render("shop", {
      user: userData,
      categories: categoryWithIds,
      products: products,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      cartItems: cartItems

    });
  } catch (error) {
    console.log("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;

    let findCategory = null;
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      findCategory = await Category.findOne({ _id: category });
    }

    const query = {
      isBlocked: false,
      // quantity: { $gt: 0 }
    };

    if (findCategory) {
      query.category = findCategory._id;
    }

    let findProducts = await Product.find(query).sort({ createdAt: -1 }).lean();

    const categories = await Category.find({ isListed: true });

    // Pagination setup
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    // Validate currentPage
    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          searchedOn: new Date(),
        };

        if (
          !userData.searchHistory.some(
            (entry) =>
              entry.category.toString() === searchEntry.category.toString()
          )
        ) {
          userData.searchHistory.push(searchEntry);
          await userData.save();
        }
      }
    }

    req.session.filteredProducts = currentProduct;

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      selectedCategory: category || null,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    let findProducts = await Product.find({
      salePrice: { $gt: req.query.gt, $lt: req.query.lt },
      isBlocked: false,
      isDeleted: false,
      // quantity: {$gt: 0}
    }).lean();

    findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination setup
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    // Validate currentPage
    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    req.session.filteredProducts = findProducts;

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    let search = req.query.search;

    const categories = await Category.find({ isListed: true }).lean();
    const categoryids = categories.map((category) => category._id.toString());
    let searchResult = [];

    if (
      req.session.filteredProducts &&
      req.session.filteredProducts.length > 0
    ) {
      searchResult = req.session.filteredProducts.filter((product) =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      searchResult = await Product.find({
        productName: { $regex: ".*" + search + ".*", $options: "i" },
        isBlocked: false,
        // quantity: {$gt: 0},
        category: { $in: categoryids },
      });
    }

    searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination setup
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    // Validate currentPage
    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const currentProduct = searchResult.slice(startIndex, endIndex);

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      count: searchResult.length,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.status(500).redirect("/pageNotFound");
      }
      return res.redirect("/");
    });
  } catch (error) {
    console.log("Log out error", error);
    res.status(500).redirect("/pageNotFound");
  }
};



module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignUp,
  signUp,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  loadShopping,
  filterProduct,
  filterByPrice,
  searchProducts,
  logout,
};
