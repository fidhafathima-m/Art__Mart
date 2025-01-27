// eslint-disable-next-line no-undef
const Order = require('../../models/orderSchema');
// eslint-disable-next-line no-undef
const Address = require('../../models/addressSchema');
// eslint-disable-next-line no-undef
const User = require('../../models/userSchema'); 
// eslint-disable-next-line no-undef
const Wallet = require('../../models/walletSchema');
// eslint-disable-next-line no-undef
const Transaction = require('../../models/transactionSchema');

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

    const order = await Order.findOne({ orderId })
      .populate('userId') 
      .populate('ordereditems.product') 
      .exec();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const userAddresses = await Address.findOne({ userId: order.userId });


    const address = userAddresses ? userAddresses.address.find(addr => addr.isDefault) : null;


    const orderDetails = {
      orderId: order.orderId,
      Id: order.userId,  
      totalPrice: order.totalprice,
      discount: order.discount,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      moneySent: order.moneySent,
      status: order.status,
      couponApplied: order.couponApplied,
      createdOn: order.createdOn,
      address: address,  
      orderedItems: order.ordereditems  
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
     
    // If the status is "Delivered", set the delivery timestamp
    if (status === "Delivered") {
      order.deliveredAt = Date.now();  
    }

    if (status === "Returned") {
      order.ordereditems.forEach(item => {
        item.returnStatus = 'Returned'; // Update the returnStatus for each item
      });
    }

    await order.save();

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

const sendMoneyToWallet = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId }).populate('userId');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status === 'Cancelled' && order.paymentMethod === 'prepaid' && !order.moneySent) {
      // Update the order's moneySent status
      order.moneySent = true;
      await order.save();

      // Find the user's wallet
      let wallet = await Wallet.findOne({ userId: order.userId._id });

      if (!wallet) {
        // If no wallet exists, create a new one
        wallet = new Wallet({
          userId: order.userId._id,
          balance: order.finalAmount,
        });
        await wallet.save();
      } else {
        // Add the order's finalAmount to the wallet balance
        wallet.balance += order.finalAmount;
        await wallet.save();
      }

      const transaction = new Transaction({
        userId: order.userId._id,
        type: 'credit', 
        amount: order.finalAmount,
        balance: wallet.balance,  
      });

      await transaction.save();

      res.json({ success: true, message: 'Money has been sent to the user\'s wallet.' });
    } else {
      return res.status(400).json({ success: false, message: 'Order is not eligible for money transfer.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

// eslint-disable-next-line no-undef
module.exports = {
    loadOrder,
    viewOrderDetails,
    updateOrderStatus,
    sendMoneyToWallet,
}