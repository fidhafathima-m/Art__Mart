/* eslint-disable no-undef */
const Brand = require("../../models/brandSchema");
const { NotFound, InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;

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
      activePage: "brands", 
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
    const description = req.body.brandDescription; // Get the brand description
    const fileBrand = await Brand.findOne({ brandName: brand });
    if (!fileBrand) {
      const newBrand = new Brand({
        brandName: brand.toUpperCase(),
        brandDescription: description, // Save the brand description
      });
      await newBrand.save();
      res.json({ success: true, message: "Brand added successfully!" });
    } else {
      res.json({ success: false, message: "Brand already exists!" });
    }
  } catch{
    res.json({ success: false, message: "Failed to add brand!" });
  }
};

const loadEditBrand = async (req, res) => {
  try {
    const brandId = req.query.id;
    const brand = await Brand.findById(brandId);
    res.render("edit-brand", { brand });
  } catch {
    res.json({ success: false, message: "Failed to load brand!" });
  }
};

const editBrand = async (req, res) => {
  const { id } = req.params;
  const { name, brandDescription } = req.body; 

  try {
    // Find the brand by ID and update it
    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      {
        brandName: name.toUpperCase(), 
        brandDescription: brandDescription, 
      },
      { new: true } 
    );

    if (updatedBrand) {
      res.json({ success: true, message: "Brand updated successfully!" });
    } else {
      res.status(NotFound).json({ success: false, message: "Brand not found" });
    }
  } catch(error) {
    console.log(error)
    res.status(InternalServerError).json({ success: false, message: "Failed to update brand!" });
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
  editBrand,
  brandBlocked,
  brandUnblocked,
  deleteBrand,
  restoreBrand,
};
