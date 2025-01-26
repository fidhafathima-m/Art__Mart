// eslint-disable-next-line no-undef
const Coupon = require("../../models/couponSchema");
// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");

const loadCoupon = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const searchQuery = {};

    if (search) {
      searchQuery.name = { $regex: ".*" + search + ".*", $options: "i" };
    }

    const couponData = await Coupon.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCoupon = await Coupon.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCoupon / limit);

    res.render("coupons", {
      coupons: couponData,
      currentPage: page,
      totalCoupon: totalCoupon,
      totalPages: totalPages,
      search: search,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageError");
  }
};

const LoadAddCoupon = async (req, res) => {
  try {
    const userData = await User.find({ isBlocked: false });
    res.render("add-coupon", { users: userData });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
  }
};

const addCoupon = async (req, res) => {
  const { name, expireOn, offerPrice, minPurchaseAmount } = req.body;

  // Check if the name is provided and is not empty
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.json({ success: false, message: "Coupon name is required." });
  }

  // Check if the expiration date is in the future
  const expirationDate = new Date(expireOn);
  const currentDate = new Date();

  if (expirationDate <= currentDate) {
    return res.json({ success: false, message: "Expiration date must be in the future." });
  }

  const lowerCaseName = name.trim().replace(/\s+/g, " ").toLowerCase();

  try {
    // Check if coupon with the same name already exists
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp("^" + lowerCaseName + "$", "i") },
    });

    if (existingCoupon) {
      return res.json({ success: false, message: "Coupon already exists." });
    }

    // Create new coupon and save to the database
    const newCoupon = new Coupon({
      name,
      expireOn: expirationDate,
      minPurchaseAmount,
      offerPrice,
      isList: true,
      isDeleted: false
    });
    await newCoupon.save();

    return res.json({ success: true, message: "Coupon added successfully." });
  } catch (error) {
    console.error("Error adding coupon:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const listCoupon = async (req, res) => {
  try {
    let id = req.query.id;
    await Coupon.updateOne({ _id: id }, { $set: { isList: false } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error unlisting coupon" });
  }
};

const unlistCoupon = async (req, res) => {
  try {
    let id = req.query.id;
    await Coupon.updateOne({ _id: id }, { $set: { isList: true } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error listing coupon" });
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const couponData = await Coupon.findOne({ _id: id });

    if (!couponData) {
      return res.redirect("/admin/pageError");
    }

    res.render("edit-coupon", { coupon: couponData });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
  }
};

const editCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, expireOn, offerPrice, minPurchaseAmount } = req.body;

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      {
        name: name,
        expireOn: expireOn,
        offerPrice: offerPrice,
        minPurchaseAmount: minPurchaseAmount,
      },
      { new: true }
    );

    if (updatedCoupon) {
      return res
        .status(200)
        .json({ success: true, message: "Coupon updated successfully!" });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to update coupon" });
    }
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};

// Soft delete coupon (set isDeleted to true)
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    // Find the coupon by ID and mark it as deleted (soft delete)
    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { isDeleted: true, deletedAt: new Date(), isList: false },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    return res.json({ success: true, message: 'Coupon soft deleted successfully' });
  } catch (error) {
    console.error('Error soft deleting coupon:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting coupon.' });
  }
};

// Restore coupon (set isDeleted to false)
const restoreCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    // Find the coupon by ID and restore it (set isDeleted to false)
    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { isDeleted: false, deletedAt: null, isList: true },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    return res.json({ success: true, message: 'Coupon restored successfully' });
  } catch (error) {
    console.error('Error restoring coupon:', error);
    return res.status(500).json({ success: false, message: 'Server error while restoring coupon.' });
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  loadCoupon,
  LoadAddCoupon,
  addCoupon,
  listCoupon,
  unlistCoupon,
  loadEditCoupon,
  editCoupon,
  deleteCoupon,
  restoreCoupon
};
