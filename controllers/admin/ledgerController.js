/* eslint-disable no-undef */
const Transaction = require("../../models/transactionSchema");
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const { InternalServerError } = require("../../helpers/httpStatusCodes");
const { INTERNAL_SERVER_ERROR } = require("../../helpers/constants").ERROR_MESSAGES;

const getLedger = async (req, res) => {
  try {
    const search = req.query.search || ""; // Get the search term from the query string
    const page = parseInt(req.query.page) || 1; // Get the page number from the query string (defaults to 1 if not provided)
    const pageSize = 10; // Number of items per page
    const skip = (page - 1) * pageSize; // Calculate how many items to skip

    // Fetch all transactions from the Transaction model with search
    const transactions = await Transaction.find({
      $or: [
        { type: new RegExp(search, "i") }, // Search by transaction type
        {
          userId: {
            $in: await User.find({ name: new RegExp(search, "i") }).distinct(
              "_id"
            ),
          },
        }, // Search by user ID
      ],
    })
      .populate("userId", "name") // Populate userId to get user names
      .sort({ date: -1 }) // Sort by date descending
      .skip(skip) // Skip the calculated number of items
      .limit(pageSize); // Limit the number of items returned

    // Fetch all orders to include payment method transactions with search
    const orders = await Order.find({
      $or: [
        { paymentMethod: new RegExp(search, "i") }, // Search by payment method
        {
          userId: {
            $in: await User.find({ name: new RegExp(search, "i") }).distinct(
              "_id"
            ),
          },
        }, // Search by user ID
      ],
    })
      .populate("userId", "name") // Populate userId to get user names
      .sort({ createdOn: -1 }) // Sort by order date descending
      .skip(skip) // Skip the calculated number of items
      .limit(pageSize); // Limit the number of items returned

    // Combine order transactions into the transactions array
    orders.forEach((order) => {
      transactions.push({
        _id: order.orderId,
        userId: order.userId,
        type: order.paymentMethod,
        amount: order.finalAmount,
        balance: order.finalAmount, // Assuming balance is the final amount for simplicity
        date: order.createdOn,
      });
    });

    // Sort combined transactions by date
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get the total number of transactions to calculate total pages
    const totalTransactions = await Transaction.countDocuments({
      $or: [
        { type: new RegExp(search, "i") },
        {
          userId: {
            $in: await User.find({ name: new RegExp(search, "i") }).distinct(
              "_id"
            ),
          },
        },
      ],
    });

    const totalPages = Math.ceil(totalTransactions / pageSize); // Calculate total pages

    // Generate pagination object
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
    };

    res.render("ledger", { transactions, pagination, search }); // Pass transactions, pagination, and search to the view
  } catch (error) {
    console.error("Error fetching ledger:", error);
    res.status(InternalServerError).send(INTERNAL_SERVER_ERROR);
  }
};

const PdfPrinter = require("pdfmake");

// Define fonts
const fonts = {
  Roboto: {
    normal: "public/fonts/Roboto-Regular.ttf",
    bold: "public/fonts/Roboto-Medium.ttf",
    italics: "public/fonts/Roboto-Italic.ttf",
    bolditalics: "public/fonts/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);

const exportPDF = async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;

    // Build date filter criteria
    let dateFilter = {};
    if (filterType === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { date: { $gte: start, $lte: end } };
    } else if (filterType === "daily") {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      dateFilter = { date: { $gte: startOfDay, $lte: endOfDay } };
    } else if (filterType === "weekly") {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { date: { $gte: weekAgo, $lte: today } };
    } else if (filterType === "monthly") {
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { date: { $gte: monthAgo, $lte: today } };
    }

    // Fetch transactions with date filter
    const transactions = await Transaction.find(dateFilter)
      .populate("userId", "name email")
      .sort({ date: -1 });

    // Fetch orders with date filter
    const orders = await Order.find({
      createdOn: dateFilter.date, // Apply the same date filter to orders
    })
      .populate("userId", "name email")
      .sort({ createdOn: -1 });

    // Combine transactions and orders into a single array
    const combinedData = [
      ...transactions.map((t) => ({
        _id: t._id,
        userId: t.userId,
        type: t.type,
        amount: t.amount,
        date: t.date,
      })),
      ...orders.map((o) => ({
        _id: o.orderId,
        userId: o.userId,
        type: o.paymentMethod,
        amount: o.finalAmount,
        date: o.createdOn,
      })),
    ];

    // Sort combined data by date
    combinedData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate totals
    const totalTransactions = combinedData.length;
    const totalAmount = combinedData.reduce((sum, t) => sum + t.amount, 0);

    // Prepare document definition
    const docDefinition = {
      content: [
        {
          image: "public/img/logo.png",
          width: 100,
        },
        {
          text: "Transaction Ledger Report",
          style: "header",
        },
        {
          text: `Total Transactions: ${totalTransactions}`,
          style: "subheader",
        },
        {
          text: `Total Amount: ${totalAmount.toFixed(2)}`,
          style: "subheader",
        },
        {
          text: `Filter: ${
            filterType.charAt(0).toUpperCase() + filterType.slice(1)
          } ${
            filterType === "custom" ? `(from ${startDate} to ${endDate})` : ""
          }`,
          style: "subheader",
        },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto", "auto"], // Adjust widths to remove source column
            body: [
              [
                { text: "ID", style: "tableHeader" },
                { text: "User ", style: "tableHeader" },
                { text: "Type", style: "tableHeader" },
                { text: "Amount", style: "tableHeader" },
                { text: "Date", style: "tableHeader" },
              ],
              ...combinedData.map((item, index) => [
                {
                  text: item._id.toString(),
                  fillColor: index % 2 === 0 ? "#d8eafc" : null,
                  margin: [5, 5, 5, 5],
                },
                {
                  text: item.userId
                    ? item.userId.name || item.userId.email
                    : "Unknown User",
                  fillColor: index % 2 === 0 ? "#d8eafc" : null,
                  margin: [5, 5, 5, 5],
                },
                {
                  text: item.type,
                  fillColor: index % 2 === 0 ? "#d8eafc" : null,
                  margin: [5, 5, 5, 5],
                },
                {
                  text: item.amount.toFixed(2),
                  fillColor: index % 2 === 0 ? "#d8eafc" : null,
                  alignment: "right",
                  margin: [5, 5, 5, 5],
                },
                {
                  text: new Date(item.date).toLocaleString(),
                  fillColor: index % 2 === 0 ? "#d8eafc" : null,
                  alignment: "center",
                  margin: [5, 5, 5, 5],
                },
              ]),
            ],
          },
        },
        {
          text: `Report generated on: ${new Date().toLocaleString()}`,
          style: "footer",
          alignment: "right",
          margin: [0, 20, 0, 0],
        },
      ],
      styles: {
        header: {
          fontSize: 28,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 20],
        },
        subheader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: "black",
        },
        footer: {
          fontSize: 10,
          italics: true,
          color: "gray",
        },
      },
    };

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction-ledger-${filterType}.pdf`
    );

    // Pipe the PDF document to the response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(InternalServerError).send("Error generating PDF report");
  }
};

module.exports = {
  getLedger,
  exportPDF,
};
