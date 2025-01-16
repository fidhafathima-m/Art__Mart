const Order = require('../../models/orderSchema');

const User = require('../../models/userSchema'); 

const loadOrder = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const users = await User.find({
      name: new RegExp(search, 'i'),   
    });
 
    const userIds = users.map(user => user._id);
 
    const orders = await Order.find({
      $or: [
        { orderId: new RegExp(search, 'i') },
        { userId: { $in: userIds } },  
        { status: new RegExp(search, 'i') },
      ]
    })
      .populate('userId')   
      .populate('ordereditems.product')   
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
      order.firstDeliveredAt = Date.now();
    }
 
    order.status = status;
     
    if (status === "Delivered") {
      order.deliveredAt = Date.now();  
    }
 
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