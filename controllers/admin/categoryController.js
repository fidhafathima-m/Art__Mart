const Category = require("../../models/categorySchema");

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
    res.render("add-category");
  } catch (error) {
    console.log(error.message);
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
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const mongoose = require("mongoose");

const loadEditCategory = async (req, res) => {
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

    const category = await Category.findOne({ _id: id });

    if (!category) {
      console.log("Category not found");
      return res.redirect("/admin/pageError");
    }

    res.render("edit-category", { category: category });
  } catch (error) {
    console.log(error.message);
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
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
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

module.exports = {
  categoryInfo,
  getListCategory,
  getUnlistCategory,
  loadAddCategory,
  addCategory,
  loadEditCategory,
  editCategory,
  deleteCategory,
  restoreCategory,
};
