const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema'); 

const loadOrder = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 7;
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

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Fetch the order details
    const order = await Order.findOne({ orderId })
      .populate('ordereditems.product') // Populate product details
      .exec();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Fetch the user's addresses
    const userAddresses = await Address.findOne({ userId: order.userId });

    console.log('user: ', order.userId);

    // Find the default address or any specific address you want to use
    const address = userAddresses ? userAddresses.address.find(addr => addr.isDefault) : null;

    // Retrieve the order details
    const orderDetails = {
      orderId: order.orderId,
      Id: order.userId,  // Assuming userId contains user info
      totalPrice: order.totalprice,
      discount: order.discount,
      finalAmount: order.finalAmount,
      status: order.status,
      couponApplied: order.couponApplied,
      createdOn: order.createdOn,
      address: address,  // Contains the address
      orderedItems: order.ordereditems  // Product details
    };

    res.render('orderDetails', { orderDetails });

  } catch (error) {
    console.error('Error loading order details:', error);
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
    viewOrderDetails,
    updateOrderStatus,
}