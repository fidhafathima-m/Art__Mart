/* eslint-disable no-undef */
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const mongoose = require("mongoose");
const multer = require("multer");
const { OK, BadRequest, NotFound, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const productInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const searchQuery = {};

    if (search) {
      searchQuery.productName = { $regex: ".*" + search + ".*", $options: "i" };
    }

    const productData = await Product.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category", "name") // Populate the category field with only the 'name' field
      .populate("brand", "brandName");

    const totalProducts = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("products", {
      product: productData,
      currentPage: page,
      totalProducts: totalProducts,
      totalPages: totalPages,
      search: search,
      currentRoute: req.originalUrl,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageError");
  }
};

const loadAddProduct = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true, isDeleted: false });
    const brand = await Brand.find({ isDeleted: false });
    res.render("add-product", { categories: category, brands: brand });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/pageError");
  }
};

const addProduct = async (req, res) => {
  try {
    const products = req.body;

    const productExists = await Product.findOne({
      productName: products.productName,
      isDeleted: false,
    });

    if (!productExists) {
      const images = [];

      // Process cropped images (base64 data)
      for (let i = 1; i <= 3; i++) {
        const base64Data = products[`croppedImage${i}`];

        if (base64Data) {
          try {
            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(base64Data, {
              folder: 'product-images',
              transformation: [
                { width: 440, height: 440, crop: 'fill' }
              ]
            });
            
            // Store the Cloudinary URL
            images.push(result.secure_url);
          } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            return res.status(BadRequest).json({ 
              success: false, 
              message: "Error uploading image to cloud storage" 
            });
          }
        }
      }

      // Validate category ID
      const categoryId = await Category.findOne({
        _id: new mongoose.Types.ObjectId(products.category.trim()),
        isListed: true,
        isDeleted: false,
      });

      if (!categoryId) {
        return res
          .status(BadRequest)
          .json({ success: false, message: "Invalid category ID" });
      }

      const brandId = await Brand.findOne({
        _id: new mongoose.Types.ObjectId(products.brand.trim()),
        isDeleted: false,
      });

      if (!brandId) {
        return res
          .status(BadRequest)
          .json({ success: false, message: "Invalid brand ID" });
      }

      // Calculate the offer price
      const percentage = products.productOffer || 0;
      const salePrice =
        products.regularPrice -
        Math.floor(products.regularPrice * (percentage / 100));

      if (salePrice < 0) {
        return res.status(BadRequest).json({
          success: false,
          message:
            "Invalid percentage: The offer leads to a negative sale price. Please adjust the percentage.",
        });
      }

      const highlights = products.highlights.filter(
        (highlight) => highlight.trim() !== ""
      );

      const status = products.quantity > 0 ? "Available" : "Out of Stock";

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        highlights: highlights,
        category: categoryId._id,
        brand: brandId._id,
        regularPrice: products.regularPrice,
        productOffer: percentage,
        salePrice: salePrice,
        createdAt: new Date(),
        quantity: products.quantity,
        productImage: images,
        status: status,
      });

      await newProduct.save();
      return res
        .status(OK)
        .json({ success: true, message: "Product added successfully" });
    } else {
      return res
        .status(BadRequest)
        .json({ success: false, message: "Product already exists" });
    }
  } catch (error) {
    if (error instanceof multer.MulterError) {
      res
        .status(BadRequest)
        .json({ success: false, message: "Only image files are allowed" });
    } else {
      res
        .status(InternalServerError)
        .json({ success: false, message: INTERNAL_SERVER_ERROR });
    }
  }
};

const loadEditProduct = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id || id.trim() === "") {
      return res.redirect("/admin/pageError");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect("/admin/pageError");
    }

    const product = await Product.findOne({ _id: id });

    if (!product) {
      return res.redirect("/admin/pageError");
    }

    const category = await Category.find({ isListed: true, isDeleted: false });
    const brand = await Brand.find({ isDeleted: false });
    res.render("edit-product", {
      product: product,
      categories: category,
      brands: brand,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (product) {
      res.json({ message: "Product soft deleted successfully" });
    } else {
      res.status(NotFound).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(InternalServerError).json({ message: "Error deleting product", error });
  }
};

const restoreProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (product) {
      res.json({ message: "Product restored successfully" });
    } else {
      res.status(NotFound).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(InternalServerError).json({ message: "Error restoring product", error });
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const products = req.body;
    const product = await Product.findById(id);
    
    if (!product) {
      return res
        .status(NotFound)
        .json({ success: false, message: "Product not found" });
    }

    const images = [...product.productImage]; // Start with existing images

    // Process cropped images (base64 data)
    for (let i = 1; i <= 3; i++) {
      const base64Data = products[`croppedImage${i}`];
      if (base64Data) {
        try {
          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(base64Data, {
            folder: 'product-images',
            transformation: [
              { width: 440, height: 440, crop: 'fill' }
            ]
          });
          
          // Store the Cloudinary URL
          images.push(result.secure_url);
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(BadRequest).json({ 
            success: false, 
            message: "Error uploading image to cloud storage" 
          });
        }
      }
    }

    const categoryId = await Category.findOne({
      _id: new mongoose.Types.ObjectId(products.category.trim()),
      isListed: true,
      isDeleted: false,
    });
    
    if (!categoryId) {
      return res
        .status(BadRequest)
        .json({ success: false, message: "Invalid category ID" });
    }

    const brandId = await Brand.findOne({
      _id: new mongoose.Types.ObjectId(products.brand.trim()),
      isDeleted: false,
    });
    
    if (!brandId) {
      return res
        .status(BadRequest)
        .json({ success: false, message: "Invalid brand ID" });
    }

    const percentage = products.productOffer || 0;
    const salePrice =
      products.regularPrice -
      Math.floor(products.regularPrice * (percentage / 100));
    
    const highlights = products.highlights.filter(
      (highlight) => highlight.trim() !== ""
    );
    
    const status = products.quantity > 0 ? "Available" : "Out of Stock";

    if (salePrice < 0) {
      return res.status(BadRequest).json({
        success: false,
        message:
          "Invalid percentage: The offer leads to a negative sale price. Please adjust the percentage.",
      });
    }

    const updateData = {
      productName: products.productName,
      description: products.description,
      highlights: highlights,
      category: categoryId._id,
      brand: brandId._id,
      regularPrice: products.regularPrice,
      productOffer: percentage,
      salePrice: salePrice,
      quantity: products.quantity,
      productImage: images,
      status: status,
    };

    await Product.findByIdAndUpdate(id, updateData, { new: true });
    res
      .status(OK)
      .json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(InternalServerError).json({ success: false, message: INTERNAL_SERVER_ERROR });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    
    if (!imageNameToServer || !productIdToServer) {
      return res
        .status(BadRequest)
        .json({ status: false, message: "Missing image name or product ID." });
    }

    const product = await Product.findById(productIdToServer);
    if (!product) {
      return res
        .status(NotFound)
        .json({ status: false, message: "Product not found." });
    }

    // Find and remove the image from the product's image array
    const imageIndex = product.productImage.indexOf(imageNameToServer);
    if (imageIndex === -1) {
      return res
        .status(NotFound)
        .json({ status: false, message: "Image not found in product." });
    }

    // Extract public_id from Cloudinary URL
    const urlParts = imageNameToServer.split('/');
    const publicId = `product-images/${urlParts[urlParts.length - 1].split('.')[0]}`;

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with product update even if Cloudinary delete fails
    }

    // Remove from product's image array
    product.productImage.splice(imageIndex, 1);
    await product.save();

    return res.json({ status: true, message: "Image deleted successfully." });
  } catch (error) {
    console.error("Error deleting image:", error.message || error);
    return res.status(InternalServerError).json({
      status: false,
      message: "Error deleting image or updating product.",
    });
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    findProduct.salePrice =
      findProduct.salePrice -
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);

    if (findProduct.salePrice < 0) {
      return res.status(BadRequest).json({
        success: false,
        message:
          "Invalid percentage: The offer leads to a negative sale price. Please adjust the percentage.",
      });
    }
    await findProduct.save();
    res.json({ status: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
    res.status(InternalServerError).json({ status: false, message: INTERNAL_SERVER_ERROR });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const percentage = findProduct.productOffer;
    findProduct.salePrice =
      findProduct.salePrice +
      Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({ status: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
  }
};

// Block Product
const blockProduct = async (req, res) => {
  try {
    const productId = req.body.id;
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: true } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error blocking product" });
  }
};

// Unblock Product
const unblockProduct = async (req, res) => {
  try {
    const productId = req.body.id;
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: false } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error unblocking product" });
  }
};

module.exports = {
  productInfo,
  loadAddProduct,
  addProduct,
  loadEditProduct,
  editProduct,
  deleteSingleImage,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  deleteProduct,
  restoreProduct,
};
