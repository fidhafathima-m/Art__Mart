// eslint-disable-next-line no-undef
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line no-undef
const Order = require('../models/orderSchema');  // Assuming you're fetching orders from the database
// eslint-disable-next-line no-undef
const Address = require('../models/addressSchema');
// eslint-disable-next-line no-undef
const User = require('../models/userSchema');

// Define fonts for pdfmake
const fonts = {
  Roboto: {
    normal: 'public/fonts/Roboto-Regular.ttf',
    bold: 'public/fonts/Roboto-Medium.ttf',
    italics: 'public/fonts/Roboto-Italic.ttf',
    bolditalics: 'public/fonts/Roboto-MediumItalic.ttf'
  }
};

const printer = new PdfPrinter(fonts);

async function generateInvoicePDF(orderId) {
    // Fetch the order from the database and populate the necessary fields
    const order = await Order.findOne({ orderId: orderId })
      .populate('ordereditems.product'); // Populate the product details in ordereditems
  
    if (!order) {
      throw new Error('Order not found');
    }
  
    console.log('Order: ', order);
  
    // Fetch the user's addresses from the Address collection
    const userAddresses = await Address.findOne({ userId: order.userId });

    const user = await User.findOne({ _id: order.userId });
  
    if (!userAddresses) {
      throw new Error('User addresses not found');
    }
  
    // Extract the default address or the first address
    const address = userAddresses.address.find(addr => addr.isDefault) || userAddresses.address[0];
  
    if (!address) {
      throw new Error('No address found for the user');
    }
  
    const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`; // Random invoice number
    const orderDate = new Date(order.createdOn).toLocaleDateString();
  

    // Prepare the table rows for ordered items
    const tableBody = [
      ['Product Name', 'Quantity', 'Price', 'Total'],
      ...order.ordereditems.map(item => {
        const product = item.product;
        const price = item.price || product.salePrice; // Use item price if available, otherwise use product salePrice
        const total = price * item.quantity;
        return [
          product.productName,
          item.quantity,
          `₹${price.toFixed(2)}`,
          `₹${total.toFixed(2)}`
        ];
      })
    ];
  
    const docDefinition = {
        content: [
          // Header Section
          {
            columns: [
              {
                image: 'public/img/logo.png', // Your logo path
                width: 100,
              },
              {
                text: 'Invoice',
                style: 'header',
                alignment: 'right',
                margin: [0, 20, 0, 0],
              },
            ],
          },
          {
            text: 'Art Mart', 
            style: 'companyName',
            alignment: 'center',
            margin: [0, 10, 0, 20],
          },
      
          // Invoice and Order Details
          {
            columns: [
              {
                text: `Invoice Number: ${invoiceNumber}`,
                style: 'subheader',
              },
              {
                text: `Order Date: ${orderDate}`,
                style: 'subheader',
                alignment: 'right',
              },
            ],
            margin: [0, 0, 0, 10],
          },
          {
            text: `Order ID: ${orderId}`, // Add Order ID
            style: 'subheader',
            margin: [0, 0, 0, 10],
          },
          {
            text: `Payment Method: ${order.paymentMethod}`,
            style: 'subheader',
            margin: [0, 0, 0, 10],
          },
          {
            text: [
              { text: 'Delivery Address:\n\n', style: 'subheaderBold' }, // Bold label
              `${user.name}\n\n`,
              `${address.name}\n`,
              `${address.city}\n`,
              `${address.state}\n`,
              `${address.pincode}\n`,
              `Phone: ${address.phone}`,
            ],
            style: 'subheader',
            margin: [0, 0, 0, 20],
          },
      
          // Product Table
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: tableBody,
            },
            layout: 'lightHorizontalLines', // Add light horizontal lines for a clean look
            margin: [0, 0, 0, 20],
          },
            order.couponApplied && order.discount > 0
            ? {
                text: `Discount Applied: ₹${order.discount.toFixed(2)}`,
                style: 'discount',
                alignment: 'right',
                margin: [0, 10, 0, 10],
                }
            : {}, // Only display if coupon was applied
      
          // Final Amount
          {
            text: `Final Amount: ₹${order.finalAmount.toFixed(2)}`,
            style: 'finalAmount',
            alignment: 'right',
            margin: [0, 10, 0, 20],
          },
      
          // Footer Section
          
          {
            text: `Invoice Bill Generated On: ${new Date().toLocaleString()}`, // Current date and time
            style: 'footer',
            alignment: 'right',
            margin: [0, 30, 0, 0],
          },
          {
            text: 'Thank you for shopping with us!',
            style: 'footer',
            alignment: 'center',
            margin: [0, 20, 0, 0],
          },
        ],
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: '#333',
          },
          companyName: {
            fontSize: 18,
            bold: true,
            color: '#555',
          },
          subheader: {
            fontSize: 12,
            color: '#666',
          },
          subheaderBold: {
            fontSize: 12,
            bold: true,
            color: '#666',
          },
          footer: {
            fontSize: 9,
            italics: true,
            color: '#777',
          },
          discount: {
            fontSize: 9,  
            color: '#d32f2f', 
            bold: true,
          },
          finalAmount: {
            fontSize: 12, 
            bold: true,   
            color: '#333', 
          },
          tableHeader: {
            bold: true,
            fontSize: 12,
            color: '#333',
            fillColor: '#f5f5f5', // Light gray background for header
          },
        },
        defaultStyle: {
          font: 'Roboto',
        },
      };
  
    // Create the PDF and return the buffer
    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      let buffers = [];
      pdfDoc.on('data', buffers.push.bind(buffers));
      pdfDoc.on('end', () => {
        // eslint-disable-next-line no-undef
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

// eslint-disable-next-line no-undef
module.exports = {
  generateInvoicePDF,
};
