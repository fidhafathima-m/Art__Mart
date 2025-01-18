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
    const user = req.session.user; 
    const categories = await Category.find({ isListed: true });

    let productsData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      // quantity: { $gt: 0 }
    })  
 
    productsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productsData = productsData.slice(0, 4); 

    if (productsData.length === 0) {
      console.log("No products found");
      return res.render("home", {
        user: req.session.user || null,   
        product: [],
        message: "No products available at the moment"
      });
    }
 
    const userData = user ? await User.findOne({ _id: user }) : null;

    const cart = await Cart.findOne({ userId: user });
     
    const cartItems = cart ? cart.items : [];
 
    if (userData) {
      res.locals.user = userData;  
      res.render("home", { 
        user: userData, 
        product: productsData,
        cartItems: cartItems,
        activePage: 'home'
      });
    } else {
      res.render("home", { product: productsData, user: null, activePage: 'home' });   
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
    // console.log("OTP sent", otp);
  } catch (error) {
    console.error("Error during signup", error);
    res.status(500).send("Internal Server Error: Failed to complete signup.");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    // console.log("Received OTP:", otp);
    // console.log("Stored OTP in session:", req.session.userOtp);

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
      // console.log("Resent OTP:", otp);
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
    const categories = await Category.find({ isListed: true, isDeleted: false });
    const categoryIds = categories.map((category) => category._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy;

    let productsQuery = Product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categoryIds },
    });

    if (sortBy === 'lowToHigh') {
      productsQuery = productsQuery.sort({ salePrice: 1 }); 
    } else if (sortBy === 'highToLow') {
      productsQuery = productsQuery.sort({ salePrice: -1 }); 
    } else {
      productsQuery = productsQuery.sort({ createdAt: -1 }); 
    }

    const allProducts = await productsQuery.lean();

    const rating = parseInt(req.query.rating) || 0;

    let filteredProducts = [];
    for (let product of allProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
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

    res.render('shop', {
      user: userData,
      categories: categoryWithIds,
      products: currentProducts,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      cartItems: cartItems,
      sortBy: sortBy,
      noProductsinCategory: '',
      noProductsMessage: '',
      activePage: 'shop',
      rating,
      selectedCategory: '',
      gt: '', lt: ''
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
 
    let findProducts = [];
    if (sortBy === "newest") {
      findProducts = await Product.find(query).sort({ createdAt: -1 }).lean();
    } else if (sortBy === "lowToHigh") {
      findProducts = await Product.find(query).sort({ salePrice: 1 }).lean();
    } else if (sortBy === "highToLow") {
      findProducts = await Product.find(query).sort({ salePrice: -1 }).lean();
    }
 
    let noProductsMessage = '';
    let noProductsinCategory = '';
 
    if (priceRange && findProducts.length === 0) {
      noProductsMessage = "Sorry, there is no products found in the selected price range.";
    }
 
    if (category && findProducts.length === 0) {
      noProductsinCategory = "Sorry, there is no products available in this category now.";
    }

    const categories = await Category.find({ isListed: true });
 
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;

    let gt = '';
    let lt = '';

    const cart = await Cart.findOne({ userId: user });
     
    const cartItems = cart ? cart.items : []; 
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
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
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
      noProductsMessage,  
      noProductsinCategory,  
      sortBy,
      gt, lt,
      cartItems: cartItems,
      activePage: 'shop',
      rating
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
 
    const gt = parseFloat(req.query.gt) || 0;  
    const lt = parseFloat(req.query.lt) || 100000;  

    const sortBy = req.query.sortBy || 'lowToHigh';  
    const selectedCategory = req.query.category || null;  
    let sortQuery = {};

    if (sortBy === 'lowToHigh') {
      sortQuery = { salePrice: 1 };  
    } else if (sortBy === 'highToLow') {
      sortQuery = { salePrice: -1 };  
    }
 
    let findProducts = await Product.find({
      salePrice: { $gt: gt, $lt: lt },
      isBlocked: false,
      isDeleted: false,
    }).sort(sortQuery).lean();
 
    let noProductsMessage = '';
    if (findProducts.length === 0) {
      noProductsMessage = "So sorry! No products available in this price range!";
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
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
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
 
    let noProductsinCategory = '';
    
 
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
      activePage: 'shop',
      rating
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
 
    let gt = '', lt = '', noProductsinCategory = '';
 
    const sortBy = req.query.sortBy || 'lowToHigh';  
    const selectedCategory = req.query.category || null;  
    let sortQuery = {};

    if (sortBy === 'lowToHigh') {
      sortQuery = { salePrice: 1 };  
    } else if (sortBy === 'highToLow') {
      sortQuery = { salePrice: -1 };  
    }
 
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).sort(sortQuery).lean();
 
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,  
      }).lean();
 
      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      }
 
      product.averageRating = averageRating;
 
      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }
 
    let noProductsMessage = '';
    if (filteredProducts.length === 0) {
      noProductsMessage = "So sorry! No products available with the selected rating!";
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
 
    res.render("shop", {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,  
      noProductsMessage,  
      selectedCategory,  
      rating,  
      cartItems,  
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
 
    const sortBy = req.query.sortBy || 'newArrivals'; 
 
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).lean();
 
    if (sortBy === 'featured') { 
      findProducts.sort((a, b) => b.featured - a.featured);
    } else if (sortBy === 'newArrivals') { 
      findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'aToZ') { 
      findProducts.sort((a, b) => {
        const nameA = a.productName || '';
        const nameB = b.productName || '';
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'zToA') { 
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
    
    
    const rating = parseInt(req.query.rating) || 0; 
    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
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
      activePage: 'shop',
      rating
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
 
    const sortBy = req.query.sortBy || 'lowToHigh'; 
 
    let findProducts = await Product.find({
      isBlocked: false,
      isDeleted: false,
    }).lean();
 
    if (sortBy === 'lowToHigh') {
      findProducts.sort((a, b) => a.salePrice - b.salePrice);  
    } else if (sortBy === 'highToLow') {
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
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

 
    const currentProducts = findProducts.slice(startIndex, endIndex); 
    res.render("shop", {
      user: userData,
      products: currentProducts,
      categories: categories,
      totalPages,
      currentPage,
      sortBy,
      cartItems: cartItems,
      activePage: 'shop',
      rating
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
    let search = req.query.search || ''; // Default to empty string if no search term
    const categories = await Category.find({ isListed: true }).lean();
    const categoryids = categories.map((category) => category._id.toString());
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

    let findProducts = await Product.find(query).lean();

    let filteredProducts = [];
    for (let product of findProducts) {
      const reviews = await Review.find({
        product_id: product._id,
        verified_purchase: true,
      }).lean();

      let averageRating = 0;
      if (reviews.length > 0) {
        averageRating = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      }

      product.averageRating = averageRating;

      if (rating === 0 || averageRating >= rating) {
        filteredProducts.push(product);
      }
    }

    if (filteredProducts.length > 0) {
      searchResult = filteredProducts.filter((product) =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    }

    let noProductsMessage  = '';
    let noProductsinCategory = '';

    if (sortBy === "priceLowToHigh") {
      searchResult.sort((a, b) => a.salePrice - b.salePrice);
    } else if (sortBy === "priceHighToLow") {
      searchResult.sort((a, b) => b.salePrice - a.salePrice);
    } else { 
      searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Pagination
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
      gt, lt,
      activePage: 'shop',
      rating,
      noProductsinCategory,
      noProductsMessage
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
