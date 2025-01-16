const Order = require('../../models/orderSchema');

const User = require('../../models/userSchema'); 

const loadOrder = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Step 1: Find users that match the username search
    const users = await User.find({
      name: new RegExp(search, 'i'),  // Use regex to search case-insensitively
    });

    // Step 2: Extract userIds from the matching users
    const userIds = users.map(user => user._id);

    // Step 3: Find orders based on userIds and other search criteria
    const orders = await Order.find({
      $or: [
        { orderId: new RegExp(search, 'i') },
        { userId: { $in: userIds } },  // Search for orders by userId from matching users
        { status: new RegExp(search, 'i') },
      ]
    })
      .populate('userId')  // Populate user details
      .populate('ordereditems.product')  // Populate product details in ordered items
      .sort({createdOn: -1})
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({
      $or: [
        { orderId: new RegExp(search, 'i') },
        { userId: { $in: userIds } },
        { status: new RegExp(search, 'i') },
      ]
    });
    
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('orders', {
      data: orders,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).send('Invalid status');
    }

    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (status === 'Delivered' && !order.firstDeliveredAt) {
      // If it hasn't been delivered before, set the firstDeliveredAt timestamp
      order.firstDeliveredAt = Date.now();
    }

    // Update order status
    order.status = status;
    
    // Check if the new status is 'Delivered'
    if (status === "Delivered") {
      order.deliveredAt = Date.now(); // Set the deliveredAt timestamp
    }

    // Save the updated order
    await order.save();

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};


module.exports = {
    loadOrder,
    updateOrderStatus,
}