// eslint-disable-next-line no-undef
const PdfPrinter = require("pdfmake");
// eslint-disable-next-line no-undef
const Order = require("../models/orderSchema");
// eslint-disable-next-line no-undef
const Address = require("../models/addressSchema");
// eslint-disable-next-line no-undef
const User = require("../models/userSchema");

// Define fonts for pdfmake
const fonts = {
  Roboto: {
    normal: "public/fonts/Roboto-Regular.ttf",
    bold: "public/fonts/Roboto-Medium.ttf",
    italics: "public/fonts/Roboto-Italic.ttf",
    bolditalics: "public/fonts/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);

async function generateInvoicePDF(orderId) {
  const order = await Order.findOne({ orderId: orderId }).populate(
    "ordereditems.product"
  ); 

  if (!order) {
    throw new Error("Order not found");
  }

  // Filter only delivered items (not cancelled items)
  const deliveredItems = order.ordereditems.filter(item => 
    item.status !== 'cancelled' && item.status !== 'returned'
  );

  // Check if there are any delivered items to generate invoice for
  if (deliveredItems.length === 0) {
    throw new Error("No delivered items in this order to generate invoice for");
  }

  const userAddresses = await Address.findOne({ userId: order.userId });

  const user = await User.findOne({ _id: order.userId });

  if (!userAddresses) {
    throw new Error("User addresses not found");
  }

  // Extract the default address or the first address
  const address =
    userAddresses.address.find((addr) => addr.isDefault) ||
    userAddresses.address[0];

  if (!address) {
    throw new Error("No address found for the user");
  }

  const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;
  const orderDate = new Date(order.createdOn).toLocaleDateString();

  // Prepare the table rows for delivered items only
  const tableBody = [
    ["Product Name", "Quantity", "Price", "Total"],
    ...deliveredItems.map((item) => {
      const product = item.product;
      const price = item.price || product.salePrice;
      const total = price * item.quantity;
      return [
        product.productName,
        item.quantity,
        `₹${price.toFixed(2)}`,
        `₹${total.toFixed(2)}`,
      ];
    }),
  ];

  // Calculate totals for delivered items only
  const deliveredItemsTotal = deliveredItems.reduce((sum, item) => {
    const price = item.price || item.product.salePrice;
    return sum + (price * item.quantity);
  }, 0);

  // Calculate discount proportionally based on delivered items
  let deliveredItemsDiscount = 0;
  if (order.originalDiscount > 0 && order.originalTotalPrice > 0) {
    const discountPercentage = (order.originalDiscount / order.originalTotalPrice) * 100;
    deliveredItemsDiscount = (deliveredItemsTotal * discountPercentage) / 100;
  }

  const deliveredFinalAmount = deliveredItemsTotal - deliveredItemsDiscount;

  // Check if there were cancelled items
  const cancelledItems = order.ordereditems.filter(item => 
    item.status === 'cancelled'
  );

  const docDefinition = {
    pageMargins: [40, 60, 40, 80],
    content: [
      // Header Section
      {
        columns: [
          {
            image: "public/img/logo.png",
            width: 100,
          },
          {
            text: "Invoice",
            style: "header",
            alignment: "right",
            margin: [0, 20, 0, 0],
          },
        ],
      },
      {
        text: "Art Mart",
        style: "companyName",
        alignment: "center",
        margin: [0, 10, 0, 20],
      },
  
      // Invoice and Order Details
      {
        columns: [
          {
            text: `Invoice Number: ${invoiceNumber}`,
            style: "subheader",
          },
          {
            text: `Order Date: ${orderDate}`,
            style: "subheader",
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: `Order ID: ${orderId}`,
        style: "subheader",
        margin: [0, 0, 0, 10],
      },
      {
        text: `Payment Method: ${order.paymentMethod}`,
        style: "subheader",
        margin: [0, 0, 0, 10],
      },
      
      // Show note if there were cancelled items
      ...(cancelledItems.length > 0 ? [{
        text: "Note: This invoice only includes delivered items. Some items were cancelled and refunded separately.",
        style: "note",
        margin: [0, 0, 0, 10],
      }] : []),
      
      {
        text: [
          { text: "Delivery Address:\n\n", style: "subheaderBold" },
          `${user.name}\n\n`,
          `${address.name}\n`,
          `${address.city}\n`,
          `${address.state}\n`,
          `${address.pincode}\n`,
          `Phone: ${address.phone}`,
        ],
        style: "subheader",
        margin: [0, 0, 0, 20],
      },
  
      // Product Table (only delivered items)
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto"],
          body: tableBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      },
      
      // Show refund details if there were cancelled items
      ...(order.totalRefunded > 0 ? [{
        text: `Amount Refunded for Cancelled Items: ₹${order.totalRefunded.toFixed(2)}`,
        style: "refund",
        alignment: "right",
        margin: [0, 10, 0, 10],
      }] : []),
      
      // Original order total (for reference)
      {
        text: `Original Order Total: ₹${order.originalFinalAmount.toFixed(2)}`,
        style: "originalTotal",
        alignment: "right",
        margin: [0, 0, 0, 5],
      },
      
      // Discount for delivered items
      deliveredItemsDiscount > 0 ? {
        text: `Discount Applied: -₹${deliveredItemsDiscount.toFixed(2)}`,
        style: "discount",
        alignment: "right",
        margin: [0, 0, 0, 5],
      } : {},
      
      // Final Amount for delivered items
      {
        text: `Amount Paid: ₹${deliveredFinalAmount.toFixed(2)}`,
        style: "finalAmount",
        alignment: "right",
        margin: [0, 10, 0, 20],
      },
      
      {
        text: `Invoice Bill Generated On: ${new Date().toLocaleString()}`,
        style: "footer",
        alignment: "right",
        margin: [0, 30, 0, 0],
      },
    ],
    footer: function(currentPage, pageCount) {
      if (currentPage === pageCount) {
        return [{
          text: "Thank you for shopping with us!",
          style: "footer",
          alignment: "center",
          margin: [0, 20, 0, 0],
        }];
      }
      return [];
    },
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        color: "#333",
      },
      companyName: {
        fontSize: 18,
        bold: true,
        color: "#555",
      },
      subheader: {
        fontSize: 12,
        color: "#666",
      },
      subheaderBold: {
        fontSize: 12,
        bold: true,
        color: "#666",
      },
      footer: {
        fontSize: 9,
        italics: true,
        color: "#777",
      },
      note: {
        fontSize: 10,
        italics: true,
        color: "#d35400",
      },
      refund: {
        fontSize: 10,
        color: "#c0392b",
        bold: true,
      },
      discount: {
        fontSize: 10,
        color: "#27ae60",
        bold: true,
      },
      originalTotal: {
        fontSize: 10,
        color: "#7f8c8d",
      },
      finalAmount: {
        fontSize: 14,
        bold: true,
        color: "#333",
      },
      tableHeader: {
        bold: true,
        fontSize: 12,
        color: "#333",
        fillColor: "#f5f5f5",
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };
  

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let buffers = [];
    pdfDoc.on("data", buffers.push.bind(buffers));
    pdfDoc.on("end", () => {
      // eslint-disable-next-line no-undef
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

// eslint-disable-next-line no-undef
module.exports = {
  generateInvoicePDF,
};