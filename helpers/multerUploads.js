// eslint-disable-next-line no-undef
const multer = require("multer");
// eslint-disable-next-line no-undef
const path = require("path");

// Define storage settings for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "";
    if (file.fieldname === "images") {
      uploadPath = "public/uploads/product-images/";
    } else if (file.fieldname === "brandImage") {
      uploadPath = "public/uploads/brand-images/";
    }

    cb(null, uploadPath);
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

// eslint-disable-next-line no-undef
module.exports = upload;
