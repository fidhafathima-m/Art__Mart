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
// eslint-disable-next-line no-undef
const User = require("../models/userSchema");
// eslint-disable-next-line no-undef
const Wallet = require("../models/walletSchema");
// eslint-disable-next-line no-undef
const Transaction = require("../models/transactionSchema");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomePage);

//signup
router.get("/signup", userAuth.isLogout, userController.loadSignUp);
router.post("/signup", userController.signUp);
router.post("/verify-referral-code", userController.veryreferralCode);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
// google signup routes
router.get('/auth/google', (req, res, next) => {
  // Store referral code in session if provided
  const referralCode = req.query.referralCode;
  if (referralCode) {
    req.session.pendingReferralCode = referralCode;
  }
  
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })(req, res, next);
});

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  async (req, res) => {
    try {
      // Handle referral code redemption if exists
      if (req.session.pendingReferralCode) {
        const referralCode = req.session.pendingReferralCode;
        const referrer = await User.findOne({ referralCode });
        
        if (referrer && !referrer.redeemedUsers.includes(req.user._id)) {
          // Credit new user
          const userWallet = await Wallet.findOne({ userId: req.user._id });
          userWallet.balance += 100;
          await userWallet.save();
          
          // Create transaction for new user
          const newTransaction = new Transaction({
            userId: req.user._id,
            type: "Referral code - Credit",
            amount: 100,
            balance: userWallet.balance
          });
          await newTransaction.save();
          
          // Credit referrer
          const referrerWallet = await Wallet.findOne({ userId: referrer._id });
          referrerWallet.balance += 200;
          await referrerWallet.save();
          
          // Create transaction for referrer
          const referrerTransaction = new Transaction({
            userId: referrer._id,
            type: "Referral Reward - Credit",
            amount: 200,
            balance: referrerWallet.balance
          });
          await referrerTransaction.save();
          
          // Update referrer's redeemed status
          referrer.redeemedUsers.push(req.user._id);
          await referrer.save();
        }
        
        // Clear the pending referral code
        delete req.session.pendingReferralCode;
      }
      
      req.session.user = req.user._id;
      
      // Redirect based on environment
      // eslint-disable-next-line no-undef
      if (process.env.NODE_ENV === 'production') {
        res.redirect('https://www.art-mart.shop/');
      } else {
        res.redirect('http://localhost:3000/');
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      res.redirect('/');
    }
  }
);

router.get("/login", userAuth.isLogout, userController.loadLogin);
router.post("/login", userController.login);

// Shopping page
router.get("/shop", userController.loadShopping);
router.get("/filter", userController.consolidatedFilter);
router.get("/search", userController.searchProducts);


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
router.get("/reset-password", profileController.resetPasswordLoad);
router.post("/reset-password", profileController.resetPassword);
router.get("/userProfile", profileController.loadUserProfile);
router.get(
  "/profile/change-password",
  profileController.loadEmailPageforPassChange
);
router.get("/profile/pass-otp-verification", profileController.passOtpPage);
router.post("/profile/change-password", profileController.changePassValid);
router.post("/profile/verify-pass-otp", profileController.verifyChangePassOtp);
router.get("/profile/order/:orderId", profileController.viewOrderDetails);
router.post("/order/cancel/:orderId", profileController.cancelOrder);
router.post("/order/cancel-item", profileController.cancelUserOrderItem);
router.post("/order/return/:orderId", profileController.returnOrder);
router.post("/order/cancel-return/:orderId", profileController.cancelReturn);
router.get("/profile/edit", profileController.loadEditProfile);
router.post("/profile/edit", profileController.editProfile);

//address management
router.get("/profile/address/add", profileController.loadAddAddress);
router.post("/profile/address/addAddress", profileController.addAddress);
router.get("/profile/address/edit", profileController.loadEditAddress);
router.post("/profile/address/edit", profileController.editAddress);
router.get("/profile/address/delete", profileController.deleteAddress);
router.post(
  "/profile/address/editAddress",
  profileController.editAddressInCheckout
);

// Product Managemrnt
router.get("/product-details", productController.loadProductDetails);
router.get(
  "/checkout/generate-invoice/:orderId",
  productController.generateInvoice
);

// Cart management
router.get("/cart", productController.loadCart);
router.post("/addToCart", productController.addToCart);
router.post(
  "/cart/update-quantity/:productId",
  productController.updateCartQuantity
);
router.delete("/cart/delete-item/:productId", productController.deletFromCart);

// Wishlist Management
router.post("/addToWishlist", productController.addToWishlist);
router.delete("/deleteFromWishlist", productController.deleteFromWishlist);

//checkout
router.get("/checkout", productController.loadCheckout);
router.post("/update-default-address", productController.updateDefaultAddress);
router.post("/checkout/place-order", productController.codPlaceOrder);
router.post(
  "/checkout/razorpay-place-order",
  productController.razorpayPlaceOrder
);
router.post("/wallet/check-balance", productController.walletBalanceCheck);
router.post("/checkout/wallet-place-order", productController.walletPlaceOrder);
router.get("/checkout/orderSuccess", productController.codOrderSuccess);
router.get("/checkout/orderFailed", productController.razorpayOrderFailed);
router.get("/retry-payment", productController.loadRetryPayment);
router.post("/retry-payment", productController.retryPayment);

//review
router.get("/profile/order/:orderId/review", productController.loadReview);
router.post("/profile/order/:orderId/review", productController.postReview);

// coupon
router.get("/api/coupons", productController.coupons);
router.post("/api/apply-coupon", productController.applyCoupon);
router.post("/api/remove-coupon", productController.removeCoupon);

// Wallet
router.post("/wallet/add-money", userController.addMoney);
router.post("/wallet/withdraw-money", userController.withdrawMoney);

// About
router.get("/about", userController.loadAbout);
router.get("/contact", userController.loadContact);
router.post("/contact/submit", userController.sendContactEmail);

// eslint-disable-next-line no-undef
module.exports = router;
