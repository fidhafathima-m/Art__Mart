/* eslint-disable no-undef */
const Brand = require("../../models/brandSchema");
const fs = require("fs");
const { NotFound, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;
const path = require("path");

const getBrand = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const searchQuery = {};
    if (search) {
      searchQuery.brandName = { $regex: ".*" + search + ".*", $options: "i" };
    }

    const brand = await Brand.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);
    const reversebrand = brand.reverse();
    res.render("brands", {
      data: reversebrand,
      totalPages,
      currentPage: page,
      totalBrands,
      search: search,
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
  }
};

const loadAddBrand = async (req, res) => {
  try {
    res.render("add-brand");
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.redirect("/admin/pageError");
  }
};

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name;
    const fileBrand = await Brand.findOne({ brandName: brand });
    if (!fileBrand) {
      const image = req.file.filename;
      const brandUpper = brand.toUpperCase();
      const newBrand = new Brand({
        brandName: brandUpper,
        brandImage: image,
      });
      await newBrand.save();
      res.json({ success: true, message: "Brand added successfully!" });
    } else {
      // Send failure response if brand already exists
      res.json({ success: false, message: "Brand already exists!" });
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Failed to add brand!" });
  }
};

const loadEditBrand = async (req, res) => {
  try {
    const brandId = req.query.id;
    const brand = await Brand.findById(brandId);
    res.render("edit-brand", { brand });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Failed to add brand!" });
  }
};

const deleteLogo = async (req, res) => {
  const { imageId } = req.params; // This should be the filename
  try {
    // Assuming you have the brand ID to find the brand
    const brand = await Brand.findOne({ brandImage: imageId });
    if (!brand) {
      return res.json({ success: false, message: "Brand logo not found!" });
    }

    // Delete the image file from the filesystem
    const imagePath = path.join(__dirname, "../uploads/brand-images", imageId);
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.json({
          success: false,
          message: "Failed to delete brand logo!",
        });
      }
    });

    // Optionally, remove the image reference from the database
    brand.brandImage = null; // or you can use `brand.remove()` if you want to delete the entire brand
    await brand.save();

    res.json({ success: true, message: "Brand logo deleted successfully!" });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Failed to delete brand logo!" });
  }
};

const brandBlocked = async (req, res) => {
  try {
    let id = req.body.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error blocking brand" });
  }
};

const brandUnblocked = async (req, res) => {
  try {
    let id = req.body.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error unblocking brand" });
  }
};

const deleteBrand = async (req, res) => {
  const { id } = req.params;

  try {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (brand) {
      res.json({ message: "Brand soft deleted successfully" });
    } else {
      res.status(NotFound).json({ message: "Brand not found" });
    }
  } catch {
    res.status(InternalServerError).json({ message: INTERNAL_SERVER_ERROR });
  }
};

const restoreBrand = async (req, res) => {
  const { id } = req.params;

  try {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (brand) {
      res.json({ message: "Brand restored successfully" });
    } else {
      res.status(NotFound).json({ message: "Brand not found" });
    }
  } catch {
    res.status(InternalServerError).json({ message: INTERNAL_SERVER_ERROR });
  }
};

module.exports = {
  getBrand,
  loadAddBrand,
  addBrand,
  loadEditBrand,
  deleteLogo,
  brandBlocked,
  brandUnblocked,
  deleteBrand,
  restoreBrand,
};
