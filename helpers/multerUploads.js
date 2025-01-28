// eslint-disable-next-line no-undef
const multer = require('multer');
// eslint-disable-next-line no-undef
const path = require('path');

// Define storage settings for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dynamically choose the folder based on the field name
    let uploadPath = '';
    if (file.fieldname === 'images') {
      uploadPath = 'public/uploads/product-images/';
    } else if (file.fieldname === 'brandImage') {
      uploadPath = 'public/uploads/brand-images/';
    }

    // Make sure the uploadPath is set correctly before calling cb()
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename for the uploaded file (timestamp + extension)
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Setup the multer upload middleware with the defined storage configuration
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }, // Set size limits as needed
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file if it's an image
    } else {
      cb(new Error("Only image files are allowed"), false); // Reject if not an image
    }
  },
});

// eslint-disable-next-line no-undef
module.exports = upload;
