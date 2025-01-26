// eslint-disable-next-line no-undef
const express = require("express");
const router = express.Router();
// eslint-disable-next-line no-undef
const userController = require("../controllers/user/userController");
// eslint-disable-next-line no-undef
const profileController = require("../controllers/user/profileController");
// eslint-disable-next-line no-undef
const productController = require("../controllers/user/productController");
// eslint-disable-next-line no-undef
const userAuth = require("../middlewares/auth");
// eslint-disable-next-line no-undef
const passport = require("passport");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomePage);

//signup
router.get("/signup", userAuth.isLogout, userController.loadSignUp);
router.post("/signup", userController.signUp);
router.post('/verify-referral-code', userController.veryreferralCode);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
// google signup routes
router.get(
  "/auth/google",
  userAuth.isLogout,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  userAuth.isLogout,
  passport.authenticate("google", {
    failureRedirect: "/signup",
  }),
  (req, res) => {
    // console.log("Authenticated user:", req.user); // For debugging
    req.session.user = req.user._id;
    res.redirect("/");
  }
);

router.get("/login", userAuth.isLogout, userController.loadLogin);
router.post("/login", userController.login);

// Shopping page
router.get("/shop", userController.loadShopping);
router.get("/filter", userController.filterProduct);
router.get("/filterPrice", userController.filterByPrice);
router.get("/filterRating", userController.filterRating);
router.get("/search", userController.searchProducts);
router.get('/sortBy', userController.sortBy);
router.get('/sortByPrice', userController.sortByPrice);

router.get("/logout", userController.logout);

// profile management
router.get(
  "/forgot-password",
  userAuth.isLogout,
  profileController.getForgetPass
);
router.post("/forgot-pass-valid", profileController.forgotPassValid);
router.get("/forgotPassOtp", profileController.forgotPassOtpLoad);
router.post("/verify-forgotPassOtp", profileController.verifyForgetPassOtp);
router.post("/resend-forgot-otp", profileController.resendForgetPassOtp);
router.get(
  "/reset-password",
  profileController.resetPasswordLoad
);
router.post("/reset-password", profileController.resetPassword);
router.get('/userProfile', profileController.loadUserProfile);
router.get('/profile/change-email', profileController.loadChangeEmail);
router.post('/profile/change-email', profileController.changeEmail);
router.get('/profile/otp-verification', profileController.otpPage);
router.post('/resend-email-otp', profileController.emailResentOtp);
router.post('/profile/verify-email-otp', profileController.verifyEmailOtp);
router.get('/profile/new-email', profileController.loadNewMail);
router.post('/profile/update-email', profileController.updateEmail);
router.get('/profile/change-password', profileController.loadEmailPageforPassChange);
router.get('/profile/pass-otp-verification', profileController.passOtpPage);
router.post('/profile/change-password', profileController.changePassValid);
router.post('/profile/verify-pass-otp', profileController.verifyChangePassOtp);
router.get('/profile/order/:orderId', profileController.viewOrderDetails);
router.post('/order/cancel/:orderId', profileController.cancelOrder);
router.post('/order/return/:orderId', profileController.returnOrder);
router.post('/order/cancel-return/:orderId', profileController.cancelReturn);
router.get('/profile/edit', profileController.loadEditProfile);
router.post('/profile/edit', profileController.editProfile);

//address management
router.get('/profile/address/add', profileController.loadAddAddress);
router.post('/profile/address/addAddress', profileController.addAddress);
router.get('/profile/address/edit', profileController.loadEditAddress);
router.post('/profile/address/edit', profileController.editAddress);
router.get('/profile/address/delete', profileController.deleteAddress);
router.post('/profile/address/editAddress', profileController.editAddressInCheckout);

// Product Managemrnt
router.get("/product-details", productController.loadProductDetails);

// Cart management
router.get("/cart", productController.loadCart);
router.post('/addToCart', productController.addToCart);
router.post('/cart/update-quantity/:productId', productController.updateCartQuantity);
router.delete('/cart/delete-item/:productId', productController.deletFromCart);

// Wishlist Management
router.post('/addToWishlist', productController.addToWishlist);
router.delete('/deleteFromWishlist', productController.deleteFromWishlist);


//checkout
router.get('/checkout', productController.loadCheckout);
router.post('/update-default-address', productController.updateDefaultAddress);
router.post('/checkout/place-order', productController.codPlaceOrder);
router.post('/checkout/razorpay-place-order', productController.razorpayPlaceOrder);
router.get('/checkout/orderSuccess', productController.codOrderSuccess);

//review
router.get('/profile/order/:orderId/review', productController.loadReview);
router.post('/profile/order/:orderId/review', productController.postReview);

// coupon
router.get('/api/coupons', productController.coupons);
router.post('/api/apply-coupon', productController.applyCoupon);
router.post('/api/remove-coupon', productController.removeCoupon);

// Wallet
router.post('/wallet/add-money', userController.addMoney);
router.post('/wallet/withdraw-money', userController.withdrawMoney);

// eslint-disable-next-line no-undef
module.exports = router;
