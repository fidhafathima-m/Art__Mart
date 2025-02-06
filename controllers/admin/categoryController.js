// eslint-disable-next-line no-undef
const Category = require("../../models/categorySchema");
// eslint-disable-next-line no-undef
const Product = require("../../models/productSchema");
// eslint-disable-next-line no-undef
const mongoose = require("mongoose");

const categoryInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const searchQuery = {};

    if (search) {
      searchQuery.name = { $regex: ".*" + search + ".*", $options: "i" };
    }

    const categoryData = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategory = await Category.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCategory / limit);

    res.render("categories", {
      category: categoryData,
      currentPage: page,
      totalCategory: totalCategory,
      totalPages: totalPages,
      search: search,
      currentRoute: req.originalUrl,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageError");
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error unlisting category" });
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error listing category" });
  }
};

const loadAddCategory = async (req, res) => {
  try {
    res.render("add-category", { currentRoute: req.originalUrl });
  } catch (error) {
    console.error(error);
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;
  const lowerCaseName = name.trim().replace(/\s+/g, " ").toLowerCase();
  try {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp("^" + lowerCaseName + "$", "i") },
    });
    if (existingCategory) {
      return res.json({ success: false, message: "Category already exists." });
    }

    const newCategory = new Category({
      name,
      description,
    });
    await newCategory.save();

    return res.json({ success: true, message: "Category added successfully." });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const loadEditCategory = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id || id.trim() === "") {
      return res.redirect("/admin/pageError");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect("/admin/pageError");
    }

    const category = await Category.findOne({ _id: id });

    if (!category) {
      return res.redirect("/admin/pageError");
    }

    res.render("edit-category", {
      category: category,
      currentRoute: req.originalUrl,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description: description },
      { new: true }
    );

    if (updatedCategory) {
      return res
        .status(200)
        .json({ success: true, message: "Category updated successfully!" });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to update category" });
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.category;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Check if any product in the category already has a higher offer
    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res.status(400).json({
        success: false,
        message: "Category already has a product offer",
      }); // Change to 400
    }

    // Update category offer
    category.categoryOffer = percentage;
    await category.save();

    // Update products with the new offer
    for (const product of products) {
      product.productOffer = percentage;
      product.salePrice = product.regularPrice * (1 - percentage / 100); // Apply discount
      await product.save();
    }

    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.category;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Reset category offer
    // eslint-disable-next-line no-unused-vars
    const percentage = category.categoryOffer;
    category.categoryOffer = 0;
    await category.save();

    // Update products to remove the offer
    const products = await Product.find({ category: category._id });
    for (const product of products) {
      product.salePrice = product.regularPrice; // Reset to original price
      product.productOffer = 0;
      await product.save();
    }

    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to remove product offer" });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date(), isListed: false },
      { new: true }
    );

    if (category) {
      res.json({ message: "Category soft deleted successfully" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error });
  }
};

const restoreCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null, isListed: true },
      { new: true }
    );

    if (category) {
      res.json({ message: "Category restored successfully" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error restoring category", error });
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  categoryInfo,
  getListCategory,
  getUnlistCategory,
  loadAddCategory,
  addCategory,
  loadEditCategory,
  editCategory,
  addCategoryOffer,
  removeCategoryOffer,
  deleteCategory,
  restoreCategory,
};
