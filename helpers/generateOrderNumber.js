/* eslint-disable no-undef */
const Order = require("../models/orderSchema");

const generateOrderNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  // Find the last order number for this month
  const lastOrder = await Order.findOne({
    orderNumber: new RegExp(`^ORD-${year}${month}-`)
  }).sort({ orderNumber: -1 });
  
  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const lastSeq = parseInt(lastOrder.orderNumber.split('-').pop());
    sequence = lastSeq + 1;
  }
  
  return `ORD-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Example: ORD-202501-0001, ORD-202501-0002, etc.

module.exports = generateOrderNumber