const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const adminProfileController = require("../controllers/admin/adminProfileController");
const adminAuth = require("../middlewares/adminAuth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const couponController = require("../controllers/admin/couponController");

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

//Product Management
// Set storage options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/product-images/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

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

module.exports = router;
