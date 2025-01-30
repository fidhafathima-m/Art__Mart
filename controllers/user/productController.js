// eslint-disable-next-line no-undef
const Product = require("../../models/productSchema");
// eslint-disable-next-line no-undef
const User = require("../../models/userSchema");
// eslint-disable-next-line no-undef
const Coupon = require("../../models/couponSchema");
// eslint-disable-next-line no-undef
const Review = require("../../models/reviewSchema");
// eslint-disable-next-line no-undef
const Address = require('../../models/addressSchema');
// eslint-disable-next-line no-undef
const Cart = require("../../models/cartSchema");
// eslint-disable-next-line no-undef
const Order = require('../../models/orderSchema');
// eslint-disable-next-line no-undef
const Wishlist = require("../../models/wishlistSchema");
// eslint-disable-next-line no-undef
const Wallet = require('../../models/walletSchema');
// eslint-disable-next-line no-undef
const Transaction = require('../../models/transactionSchema');
// eslint-disable-next-line no-undef
const mongoose = require("mongoose");
// eslint-disable-next-line no-undef
const nodemailer = require('nodemailer');
// eslint-disable-next-line no-undef
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  // eslint-disable-next-line no-undef
  key_id: process.env.RAZORPAY_ID_KEY,
  // eslint-disable-next-line no-undef  
  key_secret: process.env.RAZORPAY_SECRET_KEY,  
});
  // eslint-disable-next-line no-undef  
const { generateInvoicePDF } = require('../../helpers/generateInvoicePDF');  


const sendOrderConfirmationEmail = async (email, order, defaultAddress) => {
  try { 
    const productIds = order.ordereditems.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } });  
 
    const productMap = {};
    products.forEach(product => {
      productMap[product._id] = product.productName;  
    });
 
    const orderedItems = order.ordereditems.map(item => 
      `<li>${productMap[item.product]} (Qty: ${item.quantity}) - ₹${item.price}</li>`
    ).join(""); 

    const totalAmount = order.finalAmount;  
    const paymentMethod = "Cash on Delivery (COD)";  
 
    const deliveryAddress = `
      <p><b>Delivery Address:</b></p>
      <p>${defaultAddress.name}</p>
      <p>${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.pincode}</p>
      <p>Phone: ${defaultAddress.phone}</p>
      ${defaultAddress.altPhone ? `<p>Alternate Phone: ${defaultAddress.altPhone}</p>` : ""}
    `;
 
    const emailContent = `
      <h2>Order from Art Mart</h2>
      <h3>Order Confirmation</h3>
      <p>Thank you for your order! Below are your order details:</p>
      <p><b>Order ID:</b> ${order._id}</p>
      <p><b>Payment Method:</b> ${paymentMethod}</p>
      <p><b>Items Ordered:</b></p>
      <ul>
        ${orderedItems}
      </ul>
      <p><b>Total Amount:</b> ₹${totalAmount}</p>
      ${deliveryAddress}
      <p>We will notify you once your order is out for delivery. Thank you for shopping with us!</p>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        // eslint-disable-next-line no-undef
        user: process.env.NODEMAILER_EMAIL,
        // eslint-disable-next-line no-undef
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      // eslint-disable-next-line no-undef
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Order Confirmation - Thank you for your purchase!",
      html: emailContent,
    });

    return info.accepted.length > 0;  
  } catch (error) {
    console.error("Error sending email", error);
    throw new Error("Failed to send confirmation email");
  }
};



const loadProductDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const productId = req.query.id;
    const product = await Product.findById(productId).populate("category brand");
    const category = product.category;
    const brand = product.brand;
    const couponData = await Coupon.find({ isList: true });

    const priceLowerBound = product.salePrice - product.salePrice * 0.2;
    const priceUpperBound = product.salePrice + product.salePrice * 0.2;

    // Get related products based on the same category and within the price range (excluding the current product)
    const relatedProducts = await Product.find({
      category: product.category._id,
      salePrice: { $gte: priceLowerBound, $lte: priceUpperBound },
      _id: { $ne: product._id },
      isBlocked: false,
      isDeleted: false,
    }).limit(4);

    const relatedProductIds = relatedProducts.map((product) => product._id);

    // Get some random products (excluding the current product and the related products)
    const randomProducts = await Product.aggregate([
      {
        $match: {
          _id: {
            $nin: [...relatedProductIds, product._id],   
          },
          isBlocked: false,
          isDeleted: false,
        },
      },
      {
        $sample: { size: 4 },  
      },
    ]);

    const reviews = await Review.find({ product_id: productId })
      .populate("user_id", "name")
      .sort({ review_date: -1 });

    // Calculate average rating
    const averageRating = await Review.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    const avgRating = averageRating.length > 0 ? averageRating[0].avgRating : 0;

    const cart = await Cart.findOne({ userId: userId });
     
    const cartItems = cart ? cart.items : [];

    res.render("product-details", {
      user: userData,
      products: product,
      category: category,
      brand: brand,
      quantity: product.quantity,
      coupons: couponData,
      relatedProducts: relatedProducts,
      randomProducts: randomProducts,
      reviews: reviews,
      avgRating: avgRating,
      cartItems: cartItems,
      activePage: 'shop'
    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};


const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;   
    const userData = await User.findOne({ _id: userId });
     
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: Product,
    });
 
    if (!cart) {
      return res.render("cart", {
        cartItems: [],
        subtotal: 0,
        user: userData,
        activePage: 'shop'
      });
    }
 
    const cartItems = cart.items.map(item => ({
      productName: item.productId.productName,
      productImage: item.productId.productImage,
      cartQuantity: item.quantity,   
      productStock: item.productId.quantity,  
      salePrice: item.productId.salePrice,
      productOffer: item.productId.productOffer,
      productId: item.productId._id,  
    }));
 
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += item.salePrice * item.cartQuantity;
    });
 
    res.render("cart", {
      user: userData,
      cartItems,
      subtotal,
      activePage: 'shop'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading cart");
  }
};


const addToCart = async(req, res) => {
  try {
    const userId = req.session.user;  

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to add items to the cart.'
      });
    } 

    const productId = req.body.productId;  
    
 
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }
 
    let cart = await Cart.findOne({ userId });

    if (!cart) { 
      cart = new Cart({
        userId,
        items: [
          {
            productId: product._id,
            quantity: 1,  
            price: product.salePrice,
            totalPrice: product.salePrice * 1, 
            status: 1,  
            cancellationReason: 0,  
          },
        ],
      });
    } else { 
      const productIndex = cart.items.findIndex(item => item.productId.toString() === product._id.toString());

      if (productIndex === -1) { 
        cart.items.push({
          productId: product._id,
          quantity: 1,  
          price: product.salePrice,
          totalPrice: product.salePrice * 1,  
          status: 1,  
          cancellationReason: 0,  
        });
      } else { 
        cart.items[productIndex].quantity += 1;
        cart.items[productIndex].totalPrice = cart.items[productIndex].price * cart.items[productIndex].quantity;
      }
    }
 
    await cart.save();
 
    res.json({ success: true, message: "Item added to cart" });  

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error adding item to cart');
  }
}

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;   
    const product = await Product.findOne({_id: productId});

    if (quantity > 5) {
      return res.status(400).json({ success: false, message: 'Cannot add more than 5 of this product.' });
    }
 
    let cart = await Cart.findOne({ userId });

    if (!cart) { 
      cart = await Cart.create({
        userId,
        items: [{
          productId,
          quantity,
          price: product.salePrice ,
          totalPrice: product.salePrice * quantity ,
          status: 1,  
          cancellationReason: null,  
        }],
      });
    } else { 
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

      if (itemIndex > -1) { 
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;  
      } else {
         
        const productPrice = product.salePrice ;
        cart.items.push({
          productId,
          quantity,
          price: productPrice,
          totalPrice: productPrice * quantity,
          status: 1,
          cancellationReason: null,
        });
      }
      await cart.save();  
    }
 
    const updatedCartItems = await Cart.find({ userId });

    res.json({
      success: true,
      updatedCartItems,   
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

const deleteItem = async function(userId, productId) {
  try { 
    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      throw new Error('Cart not found');
    }
 
    const updatedCart = await Cart.updateOne(
      { userId: userId },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } }
    );
 
    return updatedCart.modifiedCount > 0;
  } catch (error) {
    console.error('Error deleting item from cart:', error);
    return false;
  }
};

const deletFromCart = async (req, res) => {
  const productId = req.params.productId;
  const userId = req.session.user;  
  

  try { 
    const result = await deleteItem(userId, productId);

    if (result) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Item not found in cart.' });
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
 
    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
     
    const userAddress = await Address.findOne({ userId: userId }).select('address');
     
    const defaultAddress = userAddress ? userAddress.address.find(addr => addr.isDefault) : null;
 
    if (!defaultAddress) {
      console.log('No default address found for the user.');
    }
 
    const cartItems = cart ? cart.items : [];
 
    res.render('checkout', {
      activePage: 'shop',
      user: userId,
      cartItems: cartItems,
      addresses: userAddress ? userAddress.address : [],   
      defaultAddress: defaultAddress || {}   
    });
  } catch (error) {
    console.log('Error loading checkout: ', error);
    res.redirect('/pageNotFound');
  }
};


const updateDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    const userId = req.session.user;
 
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User is not authenticated' });
    }
 
    await Address.updateMany(
      { userId: userId },
      { $set: { "address.$[].isDefault": false } }
    );
 
    const updatedAddress = await Address.updateOne(
      { userId: userId, "address._id": addressId },
      { $set: { "address.$.isDefault": true } }
    );
 
    if (updatedAddress.nModified === 0) {
      return res.status(400).json({ success: false, message: 'Address not found or already set as default' });
    }
 
    res.status(200).json({ success: true, message: 'Default address updated successfully' });
  } catch (error) {
    console.error('Error updating default address:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const codPlaceOrder = async (req, res) => {
  try {
    const { ordereditems, totalprice, finalAmount, discount, status, couponApplied } = req.body;
    const userId = req.session.user;  


    const userAddresses = await Address.find({ userId: userId });
    if (!userAddresses || userAddresses.length === 0) {
      return res.status(400).json({ success: false, message: "No addresses found for the user" });
    }

    const defaultAddress = userAddresses
      .flatMap(addr => addr.address)  
      .find(addr => addr.isDefault === true);

    if (!defaultAddress) {
      return res.status(400).json({ success: false, message: "No default address found" });
    }

    const newOrder = new Order({
      userId: userId, 
      ordereditems,
      totalprice,
      finalAmount,
      address: defaultAddress._id,  
      status: status || "Pending",  
      createdOn: new Date(),
      invoiceDate: new Date(),
      couponApplied,  // Store if the coupon was applied
      discount,       // Store the discount value
      paymentMethod: 'COD'
    });
    

    const savedOrder = await newOrder.save(); 

    for (const item of ordereditems) {
      const productId = item.product;
      const orderedQuantity = item.quantity;
 
      const product = await Product.findById(productId);
      if (product) { 
        if (product.quantity < orderedQuantity) {
          return res.status(400).json({ success: false, message: `Not enough stock for product ${product.productName}` });
        } 
        product.quantity -= orderedQuantity;
        await product.save();
      }
    }

    // Remove items from cart after order is placed
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { items: { productId: { $in: ordereditems.map(item => item.product) } } } }
    );

    const userData = await User.findOne({_id: userId});
    const userEmail = userData.email;   
    const emailSent = await sendOrderConfirmationEmail(userEmail, savedOrder, defaultAddress);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send order confirmation email." });
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId: savedOrder.orderId,
    });

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: "An error occurred while placing the order. Please try again." });
  }
};


const codOrderSuccess = async (req, res) => {
  try { 
    const { orderId } = req.query;

    console.log('orderId', orderId);

    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    const order = await Order.findOne({ orderId: orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }



    res.render('order-success', {
      order,
      message: "Your order has been successfully placed!",
      activePage: 'shop',
      user: user,
      cartItems: cartItems,
    });
  } catch (error) {
    console.log("Error retrieving order:", error);
    return res.status(500).json({ message: "An error occurred while fetching the order details." });
  }
};

const razorpayOrderFailed = async(req, res) => {
  try {

    const { orderId } = req.query;

    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    const order = await Order.findOne({orderId: orderId});

    if(!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update order status to "Payment Pending"
    order.status = "Payment Pending";
    await order.save();
      
    res.render('order-failed', { 
      order: order,
      activePage: 'shop',
      user: user,
      cartItems: cartItems,
     });
    
  } catch (error) {
    console.log("Error retrieving order:", error);
    return res.status(500).json({ message: "An error occurred while fetching the order details." });
  }
}

const loadRetryPayment = async (req, res) => {
  const { orderId } = req.query;

  try {
    const order = await Order.findOne({orderId: orderId});
    if (!order) {
      return res.status(404).send('Order not found');
    }
    const user = req.session.user;

    const userAddresses = await Address.findOne({ userId: user });

    const address = userAddresses ? userAddresses.address.find(addr => addr.isDefault) : null;

    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    res.render('retry-checkout', {
      order: order,
      activePage: 'shop',
      user: user,
      cartItems,
      address: address
    });
  } catch (error) {
    console.error('Error loading retry payment page:', error);
    res.redirect('/pageNotFound');
  }
};

const retryPayment = async (req, res) => {
  const { orderId, paymentMethod } = req.body;

  try {
    const order = await Order.findOne({orderId: orderId});
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Prepare order data for payment processing
    const orderData = {
      ordereditems: order.ordereditems,
      totalprice: order.totalprice,
      finalAmount: order.finalAmount,
      address: order.address,
      discount: order.discount,
      couponApplied: order.couponApplied,
      userId: order.userId // Include userId for further processing
    };

    // Logic to process the payment based on the selected payment method
    if (paymentMethod === 'razorpay') {
      // Create a Razorpay order
      const options = {
        amount: orderData.finalAmount * 100, // Convert to paise
        currency: 'INR',
        receipt: `receipt_${orderId}`,
        payment_capture: 1,
      };

      const razorpayOrder = await razorpay.orders.create(options);
      order.orderId = razorpayOrder.id; // Store Razorpay order ID in the order document
      order.status = 'Pending';
      await order.save();

      // Return Razorpay order details to frontend
      return res.json({
        success: true,
        orderId: razorpayOrder.id,
        amount: orderData.finalAmount,
        currency: 'INR',
        // eslint-disable-next-line no-undef
        razorpayKey: process.env.RAZORPAY_ID_KEY,
        paymentMethod: 'razorpay'
      });

    } else if (paymentMethod === 'cod') {
      order.status = 'Pending'; // Update the order status
      order.paymentMethod = 'COD'
      await order.save();

      // Return a JSON response with the redirect URL
      return res.json({
        success: true,
        paymentMethod: 'cod',
        redirectUrl: `/checkout/orderSuccess?orderId=${orderId}`,
      });

    } else if (paymentMethod === 'wallet') {
      // Check wallet balance
      const wallet = await Wallet.findOne({ userId: orderData.userId });
      if (!wallet || wallet.balance < orderData.finalAmount) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }

      // Deduct the amount from the wallet
      wallet.balance -= orderData.finalAmount;
      await wallet.save();

      // Create a transaction record
      const transaction = new Transaction({
        userId: orderData.userId,
        type: 'Purchased using wallet - Debit',
        amount: orderData.finalAmount,
        balance: wallet.balance,
      });
      await transaction.save();

      // Update order status to "Paid"
      order.status = "Pending"; // Update the order status
      order.paymentMethod = 'wallet'
      await order.save();

      // Return a JSON response with the redirect URL
      return res.json({
        success: true,
        paymentMethod: 'wallet',
        redirectUrl: `/checkout/orderSuccess?orderId=${orderId}`,
      });
    }

     // If none of the conditions match, return an error
     return res.status(400).json({ success: false, message: 'Invalid payment method' });
  } catch (error) {
    console.error('Error processing retry payment:', error);
    res.redirect('/checkout/orderFailed?orderId=' + orderId);
  }
};

const walletBalanceCheck = async(req, res) => {
  const { amount } = req.body;
  const userId = req.session.user;

  try {
    const wallet = await Wallet.findOne({ userId: userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return res.status(500).json({ success: false, message: "An error occurred while checking the wallet balance." });
  }
}

const walletPlaceOrder = async(req, res) => {
  try {
    const { ordereditems, totalprice, finalAmount, discount, status, couponApplied } = req.body;
    const userId = req.session.user;

    // Check if the user has a default address
    const userAddresses = await Address.find({ userId: userId });
    if (!userAddresses || userAddresses.length === 0) {
      return res.status(400).json({ success: false, message: "No addresses found for the user" });
    }

    const defaultAddress = userAddresses
      .flatMap(addr => addr.address)
      .find(addr => addr.isDefault === true);

    if (!defaultAddress) {
      return res.status(400).json({ success: false, message: "No default address found" });
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ userId: userId });
    if (!wallet || wallet.balance < finalAmount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Deduct the amount from the wallet
    wallet.balance -= finalAmount;
    await wallet.save();

    // Create a transaction record
    const transaction = new Transaction({
      userId: userId,
      type: 'Purchased using wallet - Debit',
      amount: finalAmount,
      balance: wallet.balance,
    });
    await transaction.save();

    // Create the order
    const newOrder = new Order({
      userId: userId,
      ordereditems,
      totalprice,
      finalAmount,
      address: defaultAddress._id,
      status: status || "Pending",
      createdOn: new Date(),
      invoiceDate: new Date(),
      couponApplied,
      discount,
      paymentMethod: 'wallet' // Set payment method to Wallet
    });

    const savedOrder = await newOrder.save();

    // Update product quantities
    for (const item of ordereditems) {
      const productId = item.product;
      const orderedQuantity = item.quantity;

      const product = await Product.findById(productId);
      if (product) {
        if (product.quantity < orderedQuantity) {
          return res.status(400).json({ success: false, message: `Not enough stock for product ${product.productName}` });
        }
        product.quantity -= orderedQuantity;
        await product.save();
      }
    }

    // Remove items from cart after order is placed
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { items: { productId: { $in: ordereditems.map(item => item.product) } } } }
    );

    const userData = await User.findOne({ _id: userId });
    const userEmail = userData.email;
    const emailSent = await sendOrderConfirmationEmail(userEmail, savedOrder, defaultAddress);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send order confirmation email." });
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId: savedOrder.orderId,
    });

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: "An error occurred while placing the order. Please try again." });
  }
}



const razorpayPlaceOrder = async (req, res) => {
  try {
    const { ordereditems, totalprice, finalAmount, discount, status, couponApplied } = req.body;
    const userId = req.session.user;  

    const userAddresses = await Address.find({ userId: userId });
    if (!userAddresses || userAddresses.length === 0) {
      return res.status(400).json({ success: false, message: "No addresses found for the user" });
    }

    const defaultAddress = userAddresses
      .flatMap(addr => addr.address)  
      .find(addr => addr.isDefault === true);

    if (!defaultAddress) {
      return res.status(400).json({ success: false, message: "No default address found" });
    }

    const newOrder = new Order({
      userId: userId, 
      ordereditems,
      totalprice,
      finalAmount,
      address: defaultAddress._id,  
      status: status || "Pending",  
      createdOn: new Date(),
      invoiceDate: new Date(),
      couponApplied, 
      discount,      
      paymentMethod: 'prepaid' 
    });

    const savedOrder = await newOrder.save(); 

    // Handle inventory update and cart removal
    for (const item of ordereditems) {
      const productId = item.product;
      const orderedQuantity = item.quantity;
 
      const product = await Product.findById(productId);
      if (product) { 
        if (product.quantity < orderedQuantity) {
          return res.status(400).json({ success: false, message: `Not enough stock for product ${product.productName}` });
        } 
        product.quantity -= orderedQuantity;
        await product.save();
      }
    }

    // Remove items from cart
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { items: { productId: { $in: ordereditems.map(item => item.product) } } } }
    );

    const amountInPaise = Math.round(finalAmount * 100);

    // Create Razorpay order
    const options = {
      amount: amountInPaise, 
      currency: 'INR',
      receipt: `receipt_${new Date().getTime()}`,
      payment_capture: 1,  
    };

    const razorpayOrder = await razorpay.orders.create(options);

    savedOrder.orderId = razorpayOrder.id;  // Store Razorpay order ID in the order document
    await savedOrder.save();

    // Return Razorpay order details to frontend
    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: finalAmount,
      currency: 'INR',
      // eslint-disable-next-line no-undef
      razorpayKey: process.env.RAZORPAY_ID_KEY,
      paymentMethod: 'razorpay'
    });

  } catch (error) {
    console.log("Error placing Razorpay order:", error);
    res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
  }
};


const loadReview = async(req, res) => {
  try {
    
    const orderId = req.params.orderId;
    const productId = req.query.product_id;
    const user = req.session.user;

    const orders = await Order.findById(orderId).populate('ordereditems.product')  
    .exec();
    const product = orders.ordereditems.find(item => item.product._id.toString() === productId).product;


    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    // Checking if the user has already submitted a review for this product in this order
    const existingReview = await Review.findOne({ 
      product_id: productId, 
      user_id: user._id 
    });

    res.render('review', {
      orders,
      product,
      activePage: 'profile',
      user: user,
      cartItems: cartItems,
      existingReview, 
    });

  } catch (error) {
    console.log("Error: ", error);
    res.status(500).json({ success: false, message: 'Failed to load review'});
  }
}

const postReview = async(req,res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.body.product_id;

    const { rating, review_text } = req.body;  
     
    if (rating < 1 || rating > 5) {
        return res.status(400).send("Rating must be between 1 and 5");
    }
 
    const order = await Order.findById(orderId).populate('ordereditems.product');
    
    if (!order) {
        return res.status(404).send("Order not found");
    }
 
    const orderedItem = order.ordereditems.find(item => item.product._id.toString() === productId);

    if (!orderedItem) {
        return res.status(400).send("Product not found in this order");
    }

 
    const newReview = new Review({
        product_id: productId,
        user_id: order.userId,   
        rating: rating,
        review_date: Date.now(),
        review_text: review_text,
        verified_purchase: true,  
    });

 
    await newReview.save();

    const product = await Product.findById(productId);
    product.reviews.push(newReview._id);  
    await product.save();
 
    res.status(200).json({
      success: true,
      message: "Thank you for your review!",
      review: newReview
  });
} catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong while submitting your review");
}
}


const addToWishlist = async(req, res) => {
  try {
    const userId = req.session.user;  

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to add items to the wishlist.'
      });
    } 

    const productId = req.body.productId;  
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send('Product not found');
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) { 
      wishlist = new Wishlist({
        userId,
        items: [  
          {
            productId: product._id,
            addedOn: Date.now()
          },
        ],
      });
    } else {
      // Check if the product already exists in the wishlist
      const productExists = wishlist.products.some(item => item.productId.toString() === productId);
      if (productExists) {
        return res.status(400).json({
          success: false,
          message: 'This product is already in your wishlist.'
        });
      }

      // Add the new item to the wishlist
      wishlist.products.push({
        productId: product._id,
        addedOn: Date.now(),
      });
    }
      
    // Save the wishlist
    await wishlist.save();

    res.json({ success: true, message: "Item added to wishlist" });  

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error adding item to wishlist');
  }
};

const deleteFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.body.productId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to remove items from the wishlist.'
      });
    }

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found.'
      });
    }

    const productIndex = wishlist.products.findIndex(item => item.productId.toString() === productId);

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your wishlist.'
      });
    }

    wishlist.products.splice(productIndex, 1);

    await wishlist.save();

    return res.json({
      success: true,
      message: 'Product removed from wishlist.'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error removing item from wishlist.'
    });
  }
};


const coupons = async(req, res) => {
  try {
    const coupons = await Coupon.find({ isDeleted: false, expireOn: { $gte: new Date() } });
    console.log('coupons: ', coupons);
    res.json(coupons);
} catch (error) {
  console.log("Error: ", error);
    res.status(500).json({ message: 'Error fetching coupons' });
}
}

const applyCoupon = async (req, res) => {
  const { code, totalPrice } = req.body;
  const userId = req.session.user; 

  try {
    const coupon = await Coupon.findOne({ name: code, isDeleted: false });

    if (!coupon) {
      return res.status(400).json({ message: 'Coupon not found' });
    }

    if (coupon.expireOn < new Date()) {
      return res.status(400).json({ message: 'Coupon has expired' });
    }

    if (totalPrice < coupon.minPurchaseAmount) {
      return res.status(400).json({ message: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} not met` });
    }

    if (coupon.userId && coupon.userId.toString() === userId.toString()) {
      return res.status(400).json({ message: 'Coupon has already been used by you' });
    }

    coupon.userId = userId; 

    await coupon.save();

    const newTotalPrice = totalPrice - coupon.offerPrice; 

    res.json({ success: true, offerPrice: coupon.offerPrice, newTotalPrice });
  } catch (error) {
    console.log("Error: ", error);
    res.status(500).json({ message: 'Error applying coupon' });
  }
};

const removeCoupon = async (req, res) => {
  const { code, totalPrice } = req.body;
  const userId = req.session.user; 

  try {
    const coupon = await Coupon.findOne({ name: code, isDeleted: false });

    if (!coupon) {
      return res.status(400).json({ message: 'Coupon not found' });
    }

    if (coupon.userId && coupon.userId.toString() === userId.toString()) {
      coupon.userId = null;
      await coupon.save();

      const newTotalPrice = totalPrice + coupon.offerPrice; 

      res.json({ success: true, newTotalPrice });
    } else {
      res.status(400).json({ message: 'Coupon was not applied by you' });
    }
  } catch (error) {
    console.log("Error: ", error);
    res.status(500).json({ message: 'Error removing coupon' });
  }
};



const generateInvoice = async (req, res) => {
  const { orderId } = req.params;

  try {
    const pdfBuffer = await generateInvoicePDF(orderId);  // Call the helper function to generate the PDF

    // Send the PDF as a response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating invoice' });
  }
}

// eslint-disable-next-line no-undef
module.exports = {
  loadProductDetails,
  loadCart,
  addToCart,
  updateCartQuantity,
  deletFromCart,
  loadCheckout,
  updateDefaultAddress,
  codPlaceOrder,
  razorpayPlaceOrder,
  walletBalanceCheck,
  walletPlaceOrder,
  codOrderSuccess,
  razorpayOrderFailed,
  loadRetryPayment,
  retryPayment,
  loadReview,
  postReview,
  addToWishlist,
  deleteFromWishlist,
  coupons,
  applyCoupon,
  removeCoupon,
  generateInvoice
}
