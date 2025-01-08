const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");

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
      .populate("category", "name");

    const totalProducts = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("products", {
      product: productData,
      currentPage: page,
      totalProducts: totalProducts,
      totalPages: totalPages,
      search: search,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageError");
  }
};

const loadAddProduct = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true, isDeleted: false });
    res.render("add-product", { categories: category });
  } catch (error) {
    console.log(error.message);
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
          const buffer = Buffer.from(base64Data.split(",")[1], "base64");
          const croppedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            Date.now() + `-cropped-image${i}.jpg`
          );

          await sharp(buffer)
            .resize({ width: 440, height: 440 })
            .toFile(croppedImagePath);

          images.push(croppedImagePath.replace("public", ""));
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
          .status(400)
          .json({ success: false, message: "Invalid category ID" });
      }

      // Calculate the offer price
      const percentage = products.productOffer || 0;
      const salePrice =
        products.regularPrice -
        Math.floor(products.regularPrice * (percentage / 100));

      if (salePrice < 0) {
        return res.status(400).json({
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
        .status(200)
        .json({ success: true, message: "Product added successfully" });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Product already exists" });
    }
  } catch (error) {
    if (error instanceof multer.MulterError) {
      res
        .status(400)
        .json({ success: false, message: "Only image files are allowed" });
    } else {
      console.log(error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
};

const loadEditProduct = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id || id.trim() === "") {
      console.log("ID is missing or empty");
      return res.redirect("/admin/pageError");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid ID format");
      return res.redirect("/admin/pageError");
    }

    const product = await Product.findOne({ _id: id });

    if (!product) {
      console.log("Product not found");
      return res.redirect("/admin/pageError");
    }

    const category = await Category.find({ isListed: true, isDeleted: false });
    res.render("edit-product", { product: product, categories: category });
  } catch (error) {
    console.log(error.message);
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
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
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
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error restoring product", error });
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const products = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const images = [...product.productImage]; // Start with existing images

    // Process cropped images (base64 data)
    for (let i = 1; i <= 3; i++) {
      const base64Data = products[`croppedImage${i}`];

      if (base64Data) {
        const buffer = Buffer.from(base64Data.split(",")[1], "base64");

        const croppedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          Date.now() + `-cropped-image${i}.jpg`
        );

        await sharp(buffer)
          .resize({ width: 440, height: 440 })
          .toFile(croppedImagePath);

        images.push(croppedImagePath.replace("public", ""));
      }
    }

    const categoryId = await Category.findOne({
      _id: new mongoose.Types.ObjectId(products.category.trim()),
      isListed: true,
      isDeleted: false,
    });

    if (!categoryId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID" });
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
      return res.status(400).json({
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
      regularPrice: products.regularPrice,
      productOffer: percentage,
      salePrice: salePrice,
      quantity: products.quantity,
      productImage: images,
      status: status,
    };

    await Product.findByIdAndUpdate(id, updateData, { new: true });

    res
      .status(200)
      .json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.log("Error: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    if (!imageNameToServer || !productIdToServer) {
      return res
        .status(400)
        .json({ status: false, message: "Missing image name or product ID." });
    }

    const product = await Product.findById(productIdToServer);
    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: "Product not found." });
    }

    // Find and remove the image from the product's image array
    const imageIndex = product.productImage.indexOf(imageNameToServer);
    if (imageIndex === -1) {
      return res
        .status(404)
        .json({ status: false, message: "Image not found in product." });
    }

    product.productImage.splice(imageIndex, 1);

    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "uploads",
      "product-images",
      path.basename(imageNameToServer)
    );

    console.log("Deleting image at path:", imagePath);

    if (!fs.existsSync(imagePath)) {
      return res
        .status(404)
        .json({ status: false, message: "Image not found on server." });
    }

    await fs.promises.unlink(imagePath);

    await product.save();

    return res.json({ status: true, message: "Image deleted successfully." });
  } catch (error) {
    console.error("Error deleting image:", error.message || error);
    return res
      .status(500)
      .json({
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
      return res.status(400).json({
        success: false,
        message:
          "Invalid percentage: The offer leads to a negative sale price. Please adjust the percentage.",
      });
    }
    await findProduct.save();
    res.json({ status: true });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
    res.status(500).json({ status: false, message: "Internal Server Error" });
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
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
  }
};

// Block Product
const blockProduct = async (req, res) => {
  try {
    const productId = req.body.id;
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: true } });
    res.json({ success: true });
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
