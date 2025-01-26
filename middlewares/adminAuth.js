const isLogin = async (req, res, next) => {
  try {
    if (req.session.admin) {
      return next(); // If admin is logged in, proceed to the requested route
    } else {
      return res.redirect("/admin/login"); // If not logged in, redirect to login
    }
  } catch (error) {
    console.log("Error in isLogin middleware:", error.message);
    return res.redirect("/admin/login");
  }
};

const isLogout = async (req, res, next) => {
  try {
    if (req.session.admin) {
      return res.redirect("/admin"); // If logged in, redirect to the dashboard
    }
    return next(); // Otherwise, proceed to the next middleware (login)
  } catch (error) {
    console.log("Error in isLogout middleware:", error.message);
    return res.redirect("/admin/login");
  }
};

// eslint-disable-next-line no-undef
module.exports = {
  isLogin,
  isLogout,
};
