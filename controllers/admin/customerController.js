/* eslint-disable no-undef */
const User = require("../../models/userSchema");
const { InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 10;

    // Fetch users with search and pagination
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .sort({ createdOn: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
        { phone: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("users", {
      data: userData,
      currentPage: page,
      totalPages: totalPages,
      search: search,
      currentRoute: req.originalUrl,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

const customerBlocked = async (req, res) => {
  try {
    let id = req.body.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error blocking user" });
  }
};

const customerUnblocked = async (req, res) => {
  try {
    let id = req.body.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ success: true });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    res.json({ success: false, message: "Error unblocking user" });
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerUnblocked,
};
