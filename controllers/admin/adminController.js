const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Order = require('../../models/orderSchema');
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
      const totalUsers = await User.countDocuments();
      const totalPendingOrders = await Order.countDocuments({ status: 'Processing' });

      // Get today's order stats
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const ordersPlacedToday = await Order.countDocuments({
        createdOn: { $gte: startOfDay, $lte: endOfDay }
      });

      const ordersDeliveredToday = await Order.countDocuments({
        firstDeliveredAt: { $gte: startOfDay, $lte: endOfDay }
      });

      // Get low stock products
      const lowStockProducts = await Product.countDocuments({ quantity: { $lt: 5 } });

      // Get total sales data for the current year
      const currentYear = new Date().getFullYear();
      const salesPerMonthData = await Order.aggregate([
        {
          $match: {
            createdOn: {
              $gte: new Date(currentYear, 0, 1), // Start of the year
              $lte: new Date(currentYear, 11, 31) // End of the year
            }
          }
        },
        {
          $unwind: "$ordereditems" // Unwind the ordered items array
        },
        {
          $group: {
            _id: { $month: "$createdOn" }, // Group by month
            totalSales: { $sum: "$ordereditems.quantity" } // Sum the quantity sold
          }
        },
        {
          $sort: { _id: 1 } // Sort by month (1 = ascending)
        }
      ]);

      // Prepare data for the graph (total sales per month)
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const salesDataPerMonth = Array(12).fill(0); // Initialize array to hold sales data for each month
      salesPerMonthData.forEach(item => {
        salesDataPerMonth[item._id - 1] = item.totalSales; // Store the sales data per month
      });

      // progress bar for most sold categories
      const categories = await Category.find({ isListed: true, isDeleted: false });
      const categoryLabels = [];
      const categorySalesData = [];

      // Initialize a dictionary to store sales data per category
      const categorySalesMap = {};

      // Loop through categories and fetch sales data
      for (const category of categories) {
        // Aggregate sales data for each category
        const salesData = await Order.aggregate([
          { 
            $unwind: "$ordereditems"  // Unwind the ordered items array in the order
          },
          { 
            $lookup: {
              from: "products",   // Join the 'products' collection
              localField: "ordereditems.product",  // Reference to product in the order
              foreignField: "_id",  // Matching product ID from the 'Product' collection
              as: "product"   // Alias for the product details
            }
          },
          { 
            $unwind: "$product"  // Unwind the resulting product data
          },
          { 
            $match: {
              "product.category": category._id,  // Filter by category ID
              $or: [ 
                { status: "Delivered" },
                { status: "Return Request" },
                { status: "Returned" },
              ] 
            }
          },
          { 
            $group: {
              _id: "$product.category",  // Group by category
              totalSales: { $sum: "$ordereditems.quantity" }  // Sum the quantity sold
            }
          }
        ]);

        // If sales data exists, store it in the categorySalesMap
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
        categorySalesMap[category._id] = totalSales;
      }

      // Sort categories by total sales and limit to the top 4
      const sortedCategories = Object.keys(categorySalesMap)
        .map(categoryId => ({
          categoryId,
          totalSales: categorySalesMap[categoryId]
        }))
        .sort((a, b) => b.totalSales - a.totalSales) // Sort in descending order
        .slice(0, 4); // Get top 4 categories

      // Fetch category names asynchronously
      const categoryDetails = await Promise.all(sortedCategories.map(async (category) => {
        const categoryDoc = await Category.findById(category.categoryId);
        return {
          name: categoryDoc.name,
          sales: category.totalSales
        };
      }));

      // Prepare the categoryLabels and categorySalesData for the chart
      categoryDetails.forEach(category => {
        categoryLabels.push(category.name);
        categorySalesData.push(category.sales);
      });

      // Calculate percentages if you want to show the proportion of each category's sales
      const totalSalesOverall = categorySalesData.reduce((acc, val) => acc + val, 0);
      const categoryPercentages = categorySalesData.map(sales => (sales / totalSalesOverall) * 100);

      // Render the dashboard with the data
      res.render('dashboard', {
        totalProducts,
        totalCategories,
        totalUsers,
        totalPendingOrders,
        ordersPlacedToday,
        ordersDeliveredToday,
        lowStockProducts,
        categoryLabels,
        categorySalesData: categoryPercentages,
        salesDataPerMonth, // Send the sales data for the graph
        months,    // Send the month names for the graph
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
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

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageError,
  logout,
};
