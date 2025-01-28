// eslint-disable-next-line no-undef
const express = require("express");
const router = express.Router();
// eslint-disable-next-line no-undef
const adminController = require("../controllers/admin/adminController");
// eslint-disable-next-line no-undef
const adminProfileController = require("../controllers/admin/adminProfileController");
// eslint-disable-next-line no-undef
const adminAuth = require("../middlewares/adminAuth");
// eslint-disable-next-line no-undef
const customerController = require("../controllers/admin/customerController");
// eslint-disable-next-line no-undef
const categoryController = require("../controllers/admin/categoryController");
// eslint-disable-next-line no-undef
const productController = require("../controllers/admin/productController");
// eslint-disable-next-line no-undef
const couponController = require("../controllers/admin/couponController");
// eslint-disable-next-line no-undef
const orderController = require('../controllers/admin/orderController');
// eslint-disable-next-line no-undef
const offerController = require('../controllers/admin/offerController');
// eslint-disable-next-line no-undef
const brandController = require('../controllers/admin/brandController');
// eslint-disable-next-line no-undef
const upload = require('../helpers/multerUploads');

router.get("/pageError", adminController.pageError);
router.get("/login", adminAuth.isLogout, adminController.loadLogin);
router.post("/login", adminController.login);

// profile management
router.get(
  "/forgot-password",
  adminAuth.isLogout,
  adminProfileController.getForgetPass
);
router.post("/forgot-pass-valid", adminProfileController.forgotPassValid);
router.get("/forgotPassOtp", adminProfileController.forgetPassOtpPage);

router.post(
  "/verify-forgotPassOtp",
  adminProfileController.verifyForgetPassOtp
);
router.post("/resend-forgot-otp", adminProfileController.resendForgetPassOtp);
router.get(
  "/reset-password",
  adminAuth.isLogout,
  adminProfileController.resetPasswordLoad
);
router.post("/reset-password", adminProfileController.resetPassword);

router.get("/", adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Customer management

router.get("/users", adminAuth.isLogin, customerController.customerInfo);
router.post(
  "/blockCustomer",
  adminAuth.isLogin,
  customerController.customerBlocked
);
router.post(
  "/unblockCustomer",
  adminAuth.isLogin,
  customerController.customerUnblocked
);

//Category Management

router.get("/categories", adminAuth.isLogin, categoryController.categoryInfo);
router.get(
  "/listCategory",
  adminAuth.isLogin,
  categoryController.getListCategory
);
router.get(
  "/unlistCategory",
  adminAuth.isLogin,
  categoryController.getUnlistCategory
);
router.get(
  "/add-category",
  adminAuth.isLogin,
  categoryController.loadAddCategory
);
router.post("/add-category", categoryController.addCategory);
router.get(
  "/edit-category",
  adminAuth.isLogin,
  categoryController.loadEditCategory
);
router.post("/edit-category/:id", categoryController.editCategory);
router.patch("/delete-category/:id", categoryController.deleteCategory);
router.patch("/restore-category/:id", categoryController.restoreCategory);

router.post(
  "/addCategoryOffer",
  adminAuth.isLogin,
  categoryController.addCategoryOffer
);
router.post(
  "/removeCategoryOffer",
  adminAuth.isLogin,
  categoryController.removeCategoryOffer
);

//Product Management

router.get("/products", adminAuth.isLogin, productController.productInfo);
router.get("/add-product", adminAuth.isLogin, productController.loadAddProduct);
router.post(
  "/add-product",
  adminAuth.isLogin,
  upload.array("images", 3),
  productController.addProduct
);
router.get(
  "/edit-product",
  adminAuth.isLogin,
  productController.loadEditProduct
);
router.post(
  "/edit-product/:id",
  adminAuth.isLogin,
  upload.array("images", 3),
  productController.editProduct
);
router.post(
  "/deleteImage",
  adminAuth.isLogin,
  productController.deleteSingleImage
);

router.post(
  "/addProductOffer",
  adminAuth.isLogin,
  productController.addProductOffer
);
router.post(
  "/removeProductOffer",
  adminAuth.isLogin,
  productController.removeProductOffer
);
router.post(
  "/block-product",
  adminAuth.isLogin,
  productController.blockProduct
);
router.post(
  "/unblock-product",
  adminAuth.isLogin,
  productController.unblockProduct
);
router.patch("/delete-product/:id", productController.deleteProduct);
router.patch("/restore-product/:id", productController.restoreProduct);

// Coupon Management
router.get("/coupons", adminAuth.isLogin, couponController.loadCoupon);
router.get("/add-coupon", adminAuth.isLogin, couponController.LoadAddCoupon);
router.post("/add-coupon", adminAuth.isLogin, couponController.addCoupon);
router.get("/listCoupon", adminAuth.isLogin, couponController.listCoupon);
router.get("/unlistCoupon", adminAuth.isLogin, couponController.unlistCoupon);
router.get("/edit-coupon", adminAuth.isLogin, couponController.loadEditCoupon);
router.post("/edit-coupon/:id", adminAuth.isLogin, couponController.editCoupon);
router.patch('/delete-coupon/:couponId', couponController.deleteCoupon);
router.patch('/restore-coupon/:couponId', couponController.restoreCoupon);


// Order Management
router.get('/orders', adminAuth.isLogin, orderController.loadOrder);
router.get('/orders/details/:orderId', adminAuth.isLogin, orderController.viewOrderDetails);
router.post('/updateOrderStatus', adminAuth.isLogin, orderController.updateOrderStatus);
router.post('/sendMoneyToWallet',adminAuth.isLogin, orderController.sendMoneyToWallet);

// sales reports
router.get('/reports', adminAuth.isLogin, adminController.salesReport);
router.post('/reports/sales', adminAuth.isLogin, adminController.salesStatistics);
router.get('/reports/export', adminAuth.isLogin, adminController.exportSalesReport);

// offer management
router.get('/offers', adminAuth.isLogin, offerController.loadOffer);
router.post("/offers/addProductOffer",offerController.addProductsOffer);
router.get('/offers/getProductOffer/:productId', offerController.getProductOffer);
router.post("/offers/removeProductOffer",offerController.removeProductsOffer);
router.post("/offers/addCategoryOffer",offerController.addCategoryOffer);
router.get('/offers/getCategoryOffer/:categoryId', offerController.getCategoryOffer);
router.post("/offers/removeCategoryOffer",offerController.removeCategoryOffer);
router.get('/offers/referralUsers', offerController.getReferredUsers);

// brand management
router.get('/brands', adminAuth.isLogin, brandController.getBrand);
router.get('/brands/add-brand', adminAuth.isLogin, brandController.loadAddBrand);
router.post('/brands/add-brand', adminAuth.isLogin, upload.single('brandImage'), brandController.addBrand);
// router.get('/brands/edit-brand', adminAuth.isLogin, brandController.loadEditBrand);
// router.delete('brands/delete-image/:imageId',adminAuth.isLogin, brandController.deleteLogo);
router.post('/brands/block-brand', adminAuth.isLogin, brandController.brandBlocked);
router.post('/brands/unblock-brand', adminAuth.isLogin, brandController.brandUnblocked);
router.patch("/delete-brand/:id", brandController.deleteBrand);
router.patch("/restore-brand/:id", brandController.restoreBrand);

// eslint-disable-next-line no-undef
module.exports = router;
