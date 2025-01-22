const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { generatePDFReport, generateExcelReport } = require('../../helpers/generateReports');


const pageError = (req, res) => {
  res.render("admin-error");
};

const loadLogin = async (req, res) => {
  if (req.session.admin) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    return res.redirect("/admin");
  }
  res.render("admin-login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin");
      } else {
        return res.render("admin-login", {
          message: "Password is incorrect or corrupted",
        });
      }
    } else {
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("Login error", error);
    return res.redirect("/pageError");
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      // Get total counts for products, categories, users, and orders
      const totalProducts = await Product.countDocuments();
      const totalCategories = await Category.countDocuments();
      const totalUsers = await User.find({ isAdmin: false }).countDocuments();
      const totalPendingOrders = await Order.countDocuments({
        status: "Processing",
      });

      // Get today's order stats
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const ordersPlacedToday = await Order.countDocuments({
        createdOn: { $gte: startOfDay, $lte: endOfDay },
      });

      const ordersDeliveredToday = await Order.countDocuments({
        firstDeliveredAt: { $gte: startOfDay, $lte: endOfDay },
      });

      // Get low stock products
      const lowStockProducts = await Product.countDocuments({
        quantity: { $lt: 5 },
      });

      // Get total sales data for the current year
      const currentYear = new Date().getFullYear();
      const salesPerMonthData = await Order.aggregate([
        {
          $match: {
            createdOn: {
              $gte: new Date(currentYear, 0, 1), // Start of the year
              $lte: new Date(currentYear, 11, 31), // End of the year
            },
          },
        },
        {
          $unwind: "$ordereditems",
        },
        {
          $group: {
            _id: { $month: "$createdOn" },
            totalSales: { $sum: "$ordereditems.quantity" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Data for graph
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const salesDataPerMonth = Array(12).fill(0);
      salesPerMonthData.forEach((item) => {
        salesDataPerMonth[item._id - 1] = item.totalSales;
      });

      // progress bar for most sold categories
      const categories = await Category.find({
        isListed: true,
        isDeleted: false,
      });
      const categoryLabels = [];
      const categorySalesData = [];

      const categorySalesMap = {};

      for (const category of categories) {
        const salesData = await Order.aggregate([
          {
            $unwind: "$ordereditems",
          },
          {
            $lookup: {
              from: "products",
              localField: "ordereditems.product",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: "$product",
          },
          {
            $match: {
              "product.category": category._id,
              $or: [
                { status: "Delivered" },
                { status: "Return Request" },
                { status: "Returned" },
              ],
            },
          },
          {
            $group: {
              _id: "$product.category",
              totalSales: { $sum: "$ordereditems.quantity" },
            },
          },
        ]);

        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
        categorySalesMap[category._id] = totalSales;
      }

      const sortedCategories = Object.keys(categorySalesMap)
        .map((categoryId) => ({
          categoryId,
          totalSales: categorySalesMap[categoryId],
        }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 4);

      const categoryDetails = await Promise.all(
        sortedCategories.map(async (category) => {
          const categoryDoc = await Category.findById(category.categoryId);
          return {
            name: categoryDoc.name,
            sales: category.totalSales,
          };
        })
      );

      categoryDetails.forEach((category) => {
        categoryLabels.push(category.name);
        categorySalesData.push(category.sales);
      });

      const totalSalesOverall = categorySalesData.reduce(
        (acc, val) => acc + val,
        0
      );
      const categoryPercentages = categorySalesData.map(
        (sales) => (sales / totalSalesOverall) * 100
      );

      res.render("dashboard", {
        totalProducts,
        totalCategories,
        totalUsers,
        totalPendingOrders,
        ordersPlacedToday,
        ordersDeliveredToday,
        lowStockProducts,
        categoryLabels,
        categorySalesData: categoryPercentages,
        salesDataPerMonth,
        months,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
    }
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err.message);
        return res.redirect("/pageError");
      }
      res.clearCookie("connect.sid");
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout:", error);
    res.redirect("/pageError");
  }
};



// Route to get report data (top and least purchased products)
const salesReport = async (req, res) => {
    try {
        // Fetch top purchased products
        const topProducts = await Order.aggregate([
            { $unwind: "$ordereditems" },
            { $group: { _id: "$ordereditems.product", totalQuantity: { $sum: "$ordereditems.quantity" } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 3 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "productDetails" } }
        ]);

        // Fetch least purchased products
        const leastProducts = await Order.aggregate([
            { $unwind: "$ordereditems" },
            { $group: { _id: "$ordereditems.product", totalQuantity: { $sum: "$ordereditems.quantity" } } },
            { $sort: { totalQuantity: 1 } },
            { $limit: 3 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "productDetails" } }
        ]);

        // Send the data to the frontend
        res.render('reports', { topProducts, leastProducts });
    } catch (error) {
        res.status(500).json({ message: error.message });
        console.log('error', error)
    }
};

const salesStatistics = async (req, res) => {
  const { filterType, specificDate, startDate, endDate } = req.body;

  let matchCriteria = {};
  if (filterType === 'custom') {
      matchCriteria.createdOn = { $gte: new Date(startDate), $lte: new Date(endDate) };
  } else if (filterType === 'daily') {
    matchCriteria.createdOn = { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lte: new Date() };
  } else if (filterType === 'weekly') {
      matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 7)), $lte: new Date() };
  } else if (filterType === 'monthly') {
      matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 30)), $lte: new Date() };
  }

  try {
      const salesData = await Order.find(matchCriteria);
      const overallSalesCount = salesData.length;
      const overallOrderAmount = salesData.reduce((acc, order) => acc + order.finalAmount, 0);
      const overallDiscount = salesData.reduce((acc, order) => acc + order.discount, 0);

      res.json({ overallSalesCount, overallOrderAmount, overallDiscount });
  } catch (error) {
      res.status(500).json({ message: error.message });
      console.log('error', error);
  }
};


const exportSalesReport = async (req, res) => {
  const { format, filterType, startDate, endDate, specificDate } = req.query;

  // Assume discounts and coupons are always included by default
  const showDiscounts = true;

  // Logic to generate the report based on the format
  if (format === 'pdf') {
      const pdfBuffer = await generatePDFReport(filterType, specificDate, startDate, endDate, showDiscounts);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
      res.send(pdfBuffer);
  } else if (format === 'excel') {
      const excelBuffer = await generateExcelReport(filterType, specificDate, startDate, endDate, showDiscounts);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
      res.send(excelBuffer);
  } else {
      res.status(400).json({ message: 'Invalid format' });
  }
};




module.exports = {
  loadLogin,
  login,
  loadDashboard,
  salesReport,
  salesStatistics,
  exportSalesReport,
  pageError,
  logout,
};
