const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
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

  const lowerCaseName = name.trim().replace(/\s+/g, " ").toLowerCase();

  try {
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp("^" + lowerCaseName + "$", "i") },
    });

    if (existingCoupon) {
      return res.json({ success: false, message: "Coupon already exists." });
    }

    const newCoupon = new Coupon({
      name,
      expireOn: new Date(expireOn),
      minPurchaseAmount,
    });
    await newCoupon.save();

    return res.json({ success: true, message: "Coupon added successfully." });
  } catch (error) {
    console.error("Error adding coupon:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
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

module.exports = {
  loadCoupon,
  LoadAddCoupon,
  addCoupon,
  listCoupon,
  unlistCoupon,
  loadEditCoupon,
  editCoupon,
};
