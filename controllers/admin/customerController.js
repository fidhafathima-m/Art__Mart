// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    // Fetch users with search and pagination
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
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
    res.status(500).send("Internal Server Error");
  }
};

const customerBlocked = async (req, res) => {
  try {
    let id = req.body.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ success: true });
  } catch (error) {
    console.log("Error: ", error);
    res.json({ success: false, message: "Error blocking user" });
  }
};

const customerUnblocked = async (req, res) => {
  try {
    let id = req.body.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ success: true });
  } catch (error) {
    console.log("Error: ", error);
    res.json({ success: false, message: "Error unblocking user" });
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  customerInfo,
  customerBlocked,
  customerUnblocked,
};
