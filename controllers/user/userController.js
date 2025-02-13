// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");
// eslint-disable-next-line no-undef
const Product = require("../../models/productSchema");
// eslint-disable-next-line no-undef
const Category = require("../../models/categorySchema");
// eslint-disable-next-line no-undef
const Cart = require("../../models/cartSchema");
// eslint-disable-next-line no-undef
const Review = require("../../models/reviewSchema");
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
// eslint-disable-next-line no-undef
const Brand = require("../../models/brandSchema");
// eslint-disable-next-line no-undef
const Fuse = require('fuse.js'); 

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

    const info = await transporter.sendMail({
      // eslint-disable-next-line no-undef
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your otp is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Stack Trace:", error.stack);
    throw new Error("Failed to send verification email");
  }
};

// securing password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    throw new Error("Failed to secure password");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(500).send("Internal Server Error: Unable to load page.");
  }
};

const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });

    let productsData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
    });

    productsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productsData = productsData.slice(0, 4);
    
    const userData = user ? await User.findOne({ _id: user }) : null;
    
    // Initialize cartItems as an empty array by default
    let cartItems = [];
    
    // Only try to fetch cart if user is logged in
    if (user) {
      const cart = await Cart.findOne({ userId: user });
      if (cart) {
        cartItems = cart.items;
      }
    }

    // Common render data object to avoid repetition
    const renderData = {
      user: userData || null,
      cartItems: cartItems,
      activePage: "home",
      product: productsData
    };

    if (productsData.length === 0) {
      return res.render("home", {
        ...renderData,
        product: [],
        message: "No products available at the moment"
      });
    }

    res.render("home", renderData);

  } catch (error) {
    // Even in error case, we need to pass cartItems
    res.status(500).render("home", {
      user: null,
      cartItems: [],
      activePage: "home",
      product: [],
      error: `Internal Server Error: Unable to load home page. Error: ${error.message}`
    });
  }
};

const loadSignUp = async (req, res) => {
  try {
    res.render("signup");
  } catch (error) {
    res
      .status(500)
      .send(
        "Internal Server Error: Unable to load sign-up page.",
        error.message
      );
  }
};

const signUp = async (req, res) => {
  try {
    const { name, phone, email, password, confirm_password, referralCode } =
      req.body;

    // Check if passwords match
    if (password !== confirm_password) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("signup", {
        message: "User  with this email already exists.",
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const sendOtp = sendVeificationMail(email, otp);

    if (!sendOtp) {
      return res.json("email-error");
    }

    // Store user data and OTP in session
    req.session.userData = {
      name,
      phone,
      email,
      password, // Store the plain password temporarily (hash it later)
      referralCode: referralCode ? referralCode : null, // Store the referral code if provided
    };
    req.session.userOtp = otp;

    // Render OTP verification page
    res.render("verify-otp");
  } catch (error) {
    console.error("Error during signup", error);
    res.status(500).send("Internal Server Error: Failed to complete signup.");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHashed = await securePassword(user.password);

      // Create a new user
      const saveUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHashed,
        referralCode: generateRandomReferralCode(user.name), // Generate a random referral code
      });

      await saveUser.save(); // Save the user to the database

      // Create a new wallet for the user
      const newWallet = new Wallet({ userId: saveUser._id, balance: 0 });
      await newWallet.save();

      // Assign the wallet to the user
      saveUser.wallet = newWallet._id;
      await saveUser.save();

      // Check if the referral code exists
      if (user.referralCode) {
        const referrer = await User.findOne({
          referralCode: user.referralCode,
        });
        if (referrer) {
          // Credit the new user with ₹100
          newWallet.balance += 100;
          await newWallet.save();

          // Create a transaction for the new user
          const newTransaction = new Transaction({
            userId: saveUser._id,
            type: "Referral code - Credit",
            amount: 100,
            balance: newWallet.balance,
          });
          await newTransaction.save();

          // Credit the referrer with ₹200
          const referrerWallet = await Wallet.findOne({ userId: referrer._id });
          if (referrerWallet) {
            referrerWallet.balance += 200;
            await referrerWallet.save();

            // Create a transaction for the referrer
            const referrerTransaction = new Transaction({
              userId: referrer._id,
              type: "Refferal Reward - Credit",
              amount: 200,
              balance: referrerWallet.balance,
            });
            await referrerTransaction.save();
          }

          // Update the referrer's redeemed status and add the new user to redeemedUsers
          referrer.redeemed = true; // Set the referrer as redeemed
          referrer.redeemedUsers.push(saveUser._id); // Add the new user to the redeemedUsers array
          await referrer.save(); // Save the referrer
        }
      }

      req.session.user = saveUser._id; // Store user ID in session
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please try again." });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error: Unable to verify OTP.",
    });
  }
};

function generateRandomReferralCode(name) {
  // Remove spaces and convert to uppercase
  const namePart = name.replace(/\s+/g, "").toUpperCase().substring(0, 3); // Take the first 3 letters of the name
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate a random 6-character alphanumeric string
  return `${namePart}-${randomPart}`; // Combine name part and random part
}

const veryreferralCode = async (req, res) => {
  const { referralCode } = req.body;

  try {
    const user = await User.findOne({ referralCode });

    // Initialize userData if it doesn't exist
    if (!req.session.userData) {
      req.session.userData = {};
    }

    if (user) {
      // Check if the referral code has already been used
      if (req.session.userData.redeemed) {
        return res.json({
          success: false,
          message: "Referral code has already been used.",
        });
      }

      // Mark the referral code as used
      req.session.userData.redeemed = true;

      return res.json({ success: true });
    } else {
      return res.json({
        success: false,
        message: "Referral code does not exist.",
      });
    }
  } catch (error) {
    console.error("Error verifying referral code:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error." });
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
      res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to resend OTP, please try again",
      });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({
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
    res
      .status(500)
      .send("Internal Server Error: Unable to load login page.", error.message);
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
    res.redirect("/");
  } catch (error) {
    console.error("Login error", error);
    res.status(500).render("login", {
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
    const brands = await Brand.find({ isDeleted: false });
    const brandIds = brands.map((brand) => brand._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    // eslint-disable-next-line no-unused-vars
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy;

    let productsQuery = Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
      $or: [
        { brand: { $in: brandIds } },
        { brand: { $exists: false } },
        { brand: null },
      ],
    });

    if (sortBy === "lowToHigh") {
      productsQuery = productsQuery.sort({ salePrice: 1 });
    } else if (sortBy === "highToLow") {
      productsQuery = productsQuery.sort({ salePrice: -1 });
    } else {
      productsQuery = productsQuery.sort({ createdAt: -1 });
    }

    const allProducts = await productsQuery
      .populate("brand", "brandName")
      .lean();

    const rating = parseInt(req.query.rating) || 0;

    let filteredProducts = [];
    for (let product of allProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    const totalProducts = filteredProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const currentProducts = filteredProducts.slice(startIndex, endIndex);

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    const categoryWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));
    const brandWithIds = brands.map((brand) => ({
      _id: brand._id,
      name: brand.brandName,
    }));
    let search = req.query.search || "";

    res.render("shop", {
      user: userData,
      categories: categoryWithIds,
      brands: brandWithIds,
      products: currentProducts,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      cartItems: cartItems,
      sortBy: sortBy,
      noProductsinCategory: "",
      noProductsMessage: "",
      activePage: "shop",
      rating,
      selectedCategory: "",
      gt: "",
      lt: "",
      search
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;
    const sortBy = req.query.sortBy || "newest";
    const priceRange = req.query.gt && req.query.lt;

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

    if (priceRange) {
      query.salePrice = { $gt: req.query.gt, $lt: req.query.lt };
    }

    // Add population to the product query
    let findProducts = [];
    if (sortBy === "newest") {
      findProducts = await Product.find(query)
        .populate('brand', 'brandName')    // Populate brand
        .populate('category', 'name')      // Populate category
        .sort({ createdAt: -1 })
        .lean();
    } else if (sortBy === "lowToHigh") {
      findProducts = await Product.find(query)
        .populate('brand', 'brandName')
        .populate('category', 'name')
        .sort({ salePrice: 1 })
        .lean();
    } else if (sortBy === "highToLow") {
      findProducts = await Product.find(query)
        .populate('brand', 'brandName')
        .populate('category', 'name')
        .sort({ salePrice: -1 })
        .lean();
    }

    let noProductsMessage = "";
    let noProductsinCategory = "";

    if (priceRange && findProducts.length === 0) {
      noProductsMessage = "Sorry, there is no products found in the selected price range.";
    }

    if (category && findProducts.length === 0) {
      noProductsinCategory = "Sorry, there is no products available in this category now.";
    }

    const categories = await Category.find({ isListed: true });

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    let gt = req.query.gt || "";
    let lt = req.query.lt || "";

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    const rating = parseInt(req.query.rating) || 0;
    let filteredProducts = [];
    
    // Process ratings and create filtered products
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    // Use filteredProducts for pagination instead of findProducts
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const currentProduct = filteredProducts.slice(startIndex, endIndex);

    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user });
      if (userData && findCategory) {
        const searchEntry = {
          category: findCategory._id,
          searchedOn: new Date(),
        };

        if (!userData.searchHistory.some(
          (entry) => entry.category?.toString() === searchEntry.category?.toString()
        )) {
          userData.searchHistory.push(searchEntry);
          await userData.save();
        }
      }
    }

    req.session.filteredProducts = currentProduct;
    let search = req.query.search || ""; 

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      selectedCategory: category || null,
      noProductsMessage,
      noProductsinCategory,
      sortBy,
      gt,
      lt,
      cartItems: cartItems,
      activePage: "shop",
      rating,
      search
    });

  } catch (error) {
    console.error('Filter product error:', error);
    res.redirect("/pageNotFound");
  }
};

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    const gt = parseFloat(req.query.gt) || 0;
    const lt = parseFloat(req.query.lt) || 100000;

    const sortBy = req.query.sortBy || "lowToHigh";
    const selectedCategory = req.query.category || null;
    let sortQuery = {};

    if (sortBy === "lowToHigh") {
      sortQuery = { salePrice: 1 };
    } else if (sortBy === "highToLow") {
      sortQuery = { salePrice: -1 };
    }

    let findProducts = await Product.find({
      salePrice: { $gt: gt, $lt: lt },
      isBlocked: false,
      isDeleted: false,
    })
    .populate('brand', 'brandName')    // Populate brand information
    .populate('category', 'name')      
      .sort(sortQuery)
      .lean();

    let noProductsMessage = "";
    if (findProducts.length === 0) {
      noProductsMessage =
        "So sorry! No products available in this price range!";
    }

    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }
    const rating = parseInt(req.query.rating) || 0;
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    req.session.filteredProducts = findProducts;

    let noProductsinCategory = "";
    let search = req.query.search || ""; 

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      noProductsMessage,
      noProductsinCategory,
      selectedCategory: selectedCategory,
      gt: gt,
      lt: lt,
      cartItems: cartItems,
      activePage: "shop",
      rating,
      search
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const filterRating = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    let gt = "",
      lt = "",
      noProductsinCategory = "";

    const sortBy = req.query.sortBy || "lowToHigh";
    const selectedCategory = req.query.category || null;
    let sortQuery = {};

    if (sortBy === "lowToHigh") {
      sortQuery = { salePrice: 1 };
    } else if (sortBy === "highToLow") {
      sortQuery = { salePrice: -1 };
    }

    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    })
    .populate('brand', 'brandName')    // Populate brand information
    .populate('category', 'name')     
      .sort(sortQuery)
      .lean();

    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      // eslint-disable-next-line no-undef
      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    let noProductsMessage = "";
    if (filteredProducts.length === 0) {
      noProductsMessage =
        "So sorry! No products available with the selected rating!";
    }

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const currentProduct = filteredProducts.slice(startIndex, endIndex);

    req.session.filteredProducts = filteredProducts;
    let search = req.query.search || ""; 

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      noProductsMessage,
      selectedCategory,
      // eslint-disable-next-line no-undef
      rating,
      cartItems,
      activePage: "shop",
      gt,
      lt,
      noProductsinCategory,
      search
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const sortBy = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    const sortBy = req.query.sortBy || "newArrivals";

    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    })
    .populate('brand', 'brandName')    // Populate brand information
    .populate('category', 'name')      // Populate category information if needed
    .lean();

    if (sortBy === "featured") {
      findProducts.sort((a, b) => b.featured - a.featured);
    } else if (sortBy === "newArrivals") {
      findProducts.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else if (sortBy === "aToZ") {
      findProducts.sort((a, b) => {
        const nameA = a.productName || "";
        const nameB = b.productName || "";
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === "zToA") {
      findProducts.sort((a, b) => {
        const nameA = a.productName || "";
        const nameB = b.productName || "";
        return nameB.localeCompare(nameA);
      });
    }

    let selectedCategory = "";
    let gt = "";
    let lt = "";
    let noProductsMessage = "";
    let noProductsinCategory = "";

    const rating = parseInt(req.query.rating) || 0;
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);
    let search = req.query.search || ""; 

    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      selectedCategory,
      gt,
      lt,
      noProductsMessage,
      noProductsinCategory,
      cartItems: cartItems,
      activePage: "shop",
      rating,
      search
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const sortByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    const sortBy = req.query.sortBy || "lowToHigh";

    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    })
    .populate('brand', 'brandName')    // Populate brand information
    .populate('category', 'name')      // Populate category information if needed
    .lean();

    if (sortBy === "lowToHigh") {
      findProducts.sort((a, b) => a.salePrice - b.salePrice);
    } else if (sortBy === "highToLow") {
      findProducts.sort((a, b) => b.salePrice - a.salePrice);
    }

    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const totalPages = Math.ceil(findProducts.length / itemsPerPage);

    const rating = parseInt(req.query.rating) || 0;
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }
    let search = req.query.search || ""; 

    const currentProducts = findProducts.slice(startIndex, endIndex);
    res.render("shop", {
      user: userData,
      products: currentProducts,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      cartItems: cartItems,
      activePage: "shop",
      rating,
      search
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    let search = req.query.search || "";
    const categories = await Category.find({ isListed: true }).lean();
    categories.map((category) => category._id.toString());
    let searchResult = [];
    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];
    const sortBy = req.query.sortBy || "newest";
    const selectedCategory = req.query.category || null;
    const gt = parseFloat(req.query.gt) || 0;
    const lt = parseFloat(req.query.lt) || Infinity;
    const rating = parseInt(req.query.rating) || 0;
    const query = {
      isBlocked: false,
      isDeleted: false,
      salePrice: { $gt: gt, $lt: lt },
      ...(selectedCategory && { category: selectedCategory }),
    };

    // Populate brand and category information
    let findProducts = await Product.find(query)
      .populate('brand', 'brandName')  // Populate brand with brandName
      .populate('category', 'name')    // Populate category with name
      .lean();

    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();
      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating =
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length;
      }
      product.averageRating = averageRating;
      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    let noProductsMessage = "";
    let noProductsinCategory = "";

    // Enhanced Fuzzy search logic
    if (req.xhr) {
      const fuseOptions = {
        keys: [
          'productName',
          'brand.brandName',    // Include brand name in search
          'category.name',      // Include category name in search
        ],
        threshold: 0.3,
        includeScore: true
      };
      const fuse = new Fuse(filteredProducts, fuseOptions);
      searchResult = fuse.search(search).map(result => result.item);
      return res.json(searchResult);
    }

    // Enhanced regular search for non-AJAX requests
    if (filteredProducts.length > 0) {
      searchResult = filteredProducts.filter((product) => {
        const searchTerm = search.toLowerCase();
        return (
          product.productName.toLowerCase().includes(searchTerm) ||
          (product.brand?.brandName && product.brand.brandName.toLowerCase().includes(searchTerm)) ||
          (product.category?.name && product.category.name.toLowerCase().includes(searchTerm))
        );
      });
    }

    // Sorting logic (you might want to add this if not already present)
    switch (sortBy) {
      case 'featured':
        searchResult.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'newArrivals':
        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'aToZ':
        searchResult.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'zToA':
        searchResult.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
    }

    // Pagination logic
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
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
      sortBy,
      cartItems: cartItems,
      selectedCategory,
      gt,
      lt,
      activePage: "shop",
      rating,
      noProductsinCategory,
      noProductsMessage,
      search,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.redirect("/pageNotFound");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).redirect("/pageNotFound");
      }
      return res.redirect("/");
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(500).redirect("/pageNotFound");
  }
};

const addMoney = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user;

  // Ensure amount is a number
  const parsedAmount = parseFloat(amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res
      .status(400)
      .json({ message: "Please enter a valid amount greater than 0." });
  }

  try {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
      });
    }

    wallet.balance += parsedAmount; // Use parsedAmount

    await wallet.save();

    const transaction = new Transaction({
      userId,
      type: "deposit",
      amount: parsedAmount, // Use parsedAmount
      balance: wallet.balance,
      date: new Date(),
    });
    await transaction.save();

    res.status(200).json({
      message: "Money added to wallet successfully!",
      wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while adding money." });
  }
};

const withdrawMoney = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user;

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid amount greater than 0.",
    });
  }

  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found.",
      });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance.",
      });
    }

    wallet.balance -= amount;
    await wallet.save();

    const transaction = new Transaction({
      userId,
      type: "withdrawal",
      amount,
      balance: wallet.balance,
      date: new Date(),
    });
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Money withdrawn successfully!",
      wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An error occurred while withdrawing money.",
    });
  }
};

const loadAbout = async (req, res) => {
  try {
    const user = req.session.user || null;
    const cart = user ? await Cart.findOne({ userId: user }) : null;
    const cartItems = cart ? cart.items : [];

    res.render("about", {
      activePage: "about",
      user,
      cartItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An error occurred.",
    });
  }
};

const loadContact = async (req, res) => {
  try {
    const user = req.session.user || "";
    // const cart = await Cart.findOne({ userId: user });
    // const cartItems = cart ? cart.items : [];

    res.render("contact", {
      activePage: "contact",
      user,
      cartItems: "",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An error occurred.",
    });
  }
};

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false, // Set to true if using SSL (e.g., Gmail uses true for port 465)
  auth: {
    // eslint-disable-next-line no-undef
    user: process.env.NODEMAILER_EMAIL,
    // eslint-disable-next-line no-undef
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

// Function to send email
const sendContactEmail = (req, res) => {
  const { name, email, subject, message } = req.body;

  // Define the email options
  const mailOptions = {
    from: email, // Sender's email address
    // eslint-disable-next-line no-undef
    to: process.env.NODEMAILER_EMAIL, // Admin email from the .env file
    subject: `New Contact Form Submission: ${subject}`, // Email subject
    text: `You have received a new message from ${name} (${email}).\n\nMessage:\n${message}`, // Plain text body
    html: `
      <p>You have received a new message from <strong>${name}</strong> (${email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `, // HTML body (optional)
  };

  // Send the email
  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error("Error sending email:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to send message. Please try again later.",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Your message has been sent successfully!",
      });
  });
};

// eslint-disable-next-line no-undef
module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignUp,
  signUp,
  veryreferralCode,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  loadShopping,
  filterProduct,
  filterByPrice,
  filterRating,
  sortBy,
  sortByPrice,
  searchProducts,
  logout,
  addMoney,
  withdrawMoney,
  loadAbout,
  loadContact,
  sendContactEmail,
  generateRandomReferralCode,
};
