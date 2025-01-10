const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require('../../models/cartSchema');
const Review = require('../../models/reviewSchema');
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
        cartItems: cartItems,
        activePage: 'home'
      });
    } else {
      res.render("home", { product: productsData, user: null, activePage: 'home' });  // Pass null if user is not logged in
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

    // Get the sortBy query parameter (default to 'lowToHigh')
    const sortBy = req.query.sortBy || 'lowToHigh';

    // Fetch products based on the sorting option
    let productsQuery = Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
    });

    // Sort the products based on the selected sorting option
    if (sortBy === 'lowToHigh') {
      productsQuery = productsQuery.sort({ salePrice: 1 }); // Sort low to high by salePrice
    } else if (sortBy === 'highToLow') {
      productsQuery = productsQuery.sort({ salePrice: -1 }); // Sort high to low by salePrice
    } else {
      // Default sorting (e.g., latest)
      productsQuery = productsQuery.sort({ createdAt: -1 });
    }

    const products = await productsQuery.skip(skip).limit(limit);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
    });
    const totalPages = Math.ceil(totalProducts / limit);

    let selectedCategory = '';
    let gt = '';
    let lt = '';
    let noProductsMessage = '';
    let noProductsinCategory = ''
    let rating = ''
    let averageRating = '';

    const categoryWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    res.render('shop', {
      user: userData,
      categories: categoryWithIds,
      products: products,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      cartItems: cartItems,
      sortBy: sortBy,
      noProductsinCategory,
      noProductsMessage,
      selectedCategory,
      gt, lt, rating,
      activePage: 'shop',
      averageRating
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
    const sortBy = req.query.sortBy || "newest"; // Default to 'newest' sorting
    const priceRange = req.query.gt && req.query.lt; // Check if price range filter is applied

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

    // Price Filter: Only if the price range is provided (gt and lt)
    if (priceRange) {
      query.salePrice = { $gt: req.query.gt, $lt: req.query.lt };
    }

    // Finding products based on query and sorting them based on sortBy parameter
    let findProducts = [];
    if (sortBy === "newest") {
      findProducts = await Product.find(query).sort({ createdAt: -1 }).lean();
    } else if (sortBy === "lowToHigh") {
      findProducts = await Product.find(query).sort({ salePrice: 1 }).lean();
    } else if (sortBy === "highToLow") {
      findProducts = await Product.find(query).sort({ salePrice: -1 }).lean();
    }

    // Define message variables
    let noProductsMessage = '';
    let noProductsinCategory = '';

    // If no products are found based on price range filter, set message
    if (priceRange && findProducts.length === 0) {
      noProductsMessage = "Sorry, there is no products found in the selected price range.";
    }

    // If no products are found based on category filter, set message
    if (category && findProducts.length === 0) {
      noProductsinCategory = "Sorry, there is no products available in this category now.";
    }

    const categories = await Category.find({ isListed: true });

    // Pagination setup
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    let gt = '';
    let lt = '';

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];
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
      noProductsMessage, // Pass the no products message to the view
      noProductsinCategory, // Pass the category specific message to the view
      sortBy,
      gt, lt,
      cartItems: cartItems,
      activePage: 'shop'

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

    // Extract price range values
    const gt = parseFloat(req.query.gt) || 0; // Minimum price filter
    const lt = parseFloat(req.query.lt) || 100000; // Maximum price filter

    const sortBy = req.query.sortBy || 'lowToHigh'; // Default to 'lowToHigh'
    const selectedCategory = req.query.category || null; // Default sorting by low to high
    let sortQuery = {};

    if (sortBy === 'lowToHigh') {
      sortQuery = { salePrice: 1 }; // Ascending order (low to high)
    } else if (sortBy === 'highToLow') {
      sortQuery = { salePrice: -1 }; // Descending order (high to low)
    }

    // Find products in the selected price range
    let findProducts = await Product.find({
      salePrice: { $gt: gt, $lt: lt },
      isBlocked: false,
      isDeleted: false,
    }).sort(sortQuery).lean();

    // Define noProductsMessage if no products found in the price range
    let noProductsMessage = '';
    if (findProducts.length === 0) {
      noProductsMessage = "So sorry! No products available in this price range!";
    }

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

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

    // Define noProductsinCategory message for the price range filter
    let noProductsinCategory = '';
    

    // Render the page with the appropriate messages
    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy, // Pass sortBy to the view
      noProductsMessage, // Pass price filter message to the view
      noProductsinCategory,
      selectedCategory: selectedCategory,
      gt: gt,
      lt: lt,
      cartItems: cartItems,
      activePage: 'shop'

    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};

const filterRating = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    // Extract rating filter (from 1 to 5)
    const rating = parseFloat(req.query.rating) || 0; // Default to 0 (no rating filter)

    let gt = '', lt = '', noProductsinCategory = '';

    // Extract sorting preference
    const sortBy = req.query.sortBy || 'lowToHigh'; // Default to 'lowToHigh'
    const selectedCategory = req.query.category || null; // Default to no selected category
    let sortQuery = {};

    if (sortBy === 'lowToHigh') {
      sortQuery = { salePrice: 1 }; // Ascending order (low to high)
    } else if (sortBy === 'highToLow') {
      sortQuery = { salePrice: -1 }; // Descending order (high to low)
    }

    // Step 1: Find all products
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).sort(sortQuery).lean();

    // Step 2: Filter products by the selected rating
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true, // Only consider verified purchases
      }).lean();

      // Calculate the average rating for this product
      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      }

      // Attach averageRating to the product object
      product.averageRating = averageRating;

      // Check if the average rating matches the filter
      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    // Define noProductsMessage if no products found with the selected rating
    let noProductsMessage = '';
    if (filteredProducts.length === 0) {
      noProductsMessage = "So sorry! No products available with the selected rating!";
    }

    const cart = await Cart.findOne({ userId: user });
    const cartItems = cart ? cart.items : [];

    // Pagination setup
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

    // Render the page with the appropriate messages and filters
    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy, // Pass sortBy to the view
      noProductsMessage, // Pass rating filter message to the view
      selectedCategory, // Pass selected category to the view
      rating, // Pass the selected rating filter to the view
      cartItems, // Pass cart items
      activePage: 'shop',
      gt, lt,
      noProductsinCategory
    });

  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};







const sortBy = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    // Get the sorting parameter from the query string
    const sortBy = req.query.sortBy || 'newArrivals';  // Default sorting by new arrivals

    // Get all products (without price filter)
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).lean();

    // Sorting Logic based on the sortBy parameter
    if (sortBy === 'featured') {
      // Sort featured products (assuming 'featured' is a boolean or numeric field)
      findProducts.sort((a, b) => b.featured - a.featured);
    } else if (sortBy === 'newArrivals') {
      // Sort by most recent products (based on `createdAt` field)
      findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'aToZ') {
      // Sort alphabetically (by name), ensure it's not undefined or null
      findProducts.sort((a, b) => {
        const nameA = a.productName || '';
        const nameB = b.productName || '';
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'zToA') {
      // Sort reverse alphabetically (by name), ensure it's not undefined or null
      findProducts.sort((a, b) => {
        const nameA = a.productName || '';
        const nameB = b.productName || '';
        return nameB.localeCompare(nameA);
      });
    }

    let selectedCategory = '';
    let gt = '';
    let lt = '';
    let noProductsMessage = '';
    let noProductsinCategory = ''

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];
    
    // Pagination setup
    let itemsPerPage = 6;  // Items per page
    let currentPage = parseInt(req.query.page) || 1;

    // Validate currentPage
    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    // Pagination logic
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);


    // Render the sorted and paginated products
    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      selectedCategory,
      gt, lt,
      noProductsMessage,
      noProductsinCategory,
      cartItems: cartItems,
      activePage: 'shop'

    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};

const sortByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    // Get the sortBy parameter from the query string
    const sortBy = req.query.sortBy || 'lowToHigh'; // Default to 'lowToHigh' if not provided

    // Default product search query (no price filtering)
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).lean();

    // Sort the products based on the selected sorting option
    if (sortBy === 'lowToHigh') {
      findProducts.sort((a, b) => a.salePrice - b.salePrice); // Sort low to high
    } else if (sortBy === 'highToLow') {
      findProducts.sort((a, b) => b.salePrice - a.salePrice); // Sort high to low
    }

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

    // Pagination setup
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Calculate total pages
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);

    // Slice the array to get the products for the current page
    const currentProducts = findProducts.slice(startIndex, endIndex);

    // Render the page with the sorted and paginated products, and pass the sortBy value
    res.render("shop", {
      user: userData,
      products: currentProducts,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      cartItems: cartItems,
      activePage: 'shop'
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

    const cart = await Cart.findOne({ userId: user });
    
    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

    const sortBy = req.query.sortBy || "newest"; // Default sorting is by "newest"

    let selectedCategory = '';
    let gt = '';
    let lt = '';
    let noProductsMessage = '';
    let noProductsinCategory = ''

    if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
      searchResult = req.session.filteredProducts.filter((product) =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      searchResult = await Product.find({
        productName: { $regex: ".*" + search + ".*", $options: "i" },
        isBlocked: false,
        category: { $in: categoryids },
      });
    }

    // Apply sorting logic based on 'sortBy'
    if (sortBy === "priceLowToHigh") {
      searchResult.sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceHighToLow") {
      searchResult.sort((a, b) => b.price - a.price);
    } else {
      // Default sort by date (newest)
      searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

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
      sortBy, 
      cartItems: cartItems,
      selectedCategory,
      noProductsinCategory,
      noProductsMessage,
      gt, lt,
      activePage: 'shop'
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
  filterRating,
  sortBy,
  sortByPrice,
  searchProducts,
  logout,
};
