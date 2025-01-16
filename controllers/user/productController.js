const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Review = require("../../models/reviewSchema");
const Address = require('../../models/addressSchema');
const Cart = require("../../models/cartSchema");
const Order = require('../../models/orderSchema');
const mongoose = require("mongoose");
const nodemailer = require('nodemailer');


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
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
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
    const product = await Product.findById(productId).populate("category");
    const category = product.category;
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
 
    const { ordereditems, totalprice, finalAmount, address, discount, status, couponApplied } = req.body;
 
    const userId = req.session.user;  
 
    const userAddresses = await Address.find({ userId: userId });
 
    if (!userAddresses || userAddresses.length === 0) {
      return res.status(400).json({success: false, message: "No addresses found for the user" });
    }
 
    const defaultAddress = userAddresses
      .flatMap(addr => addr.address)  
      .find(addr => addr.isDefault === true);
 
    if (!defaultAddress) {
      return res.status(400).json({success: false, message: "No default address found" });
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
 
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { items: { productId: { $in: ordereditems.map(item => item.product) } } } }
    );

    const userData = await User.findOne({_id: userId});

    const userEmail = userData.email;   
    const emailSent = await sendOrderConfirmationEmail(userEmail, savedOrder, defaultAddress);

    if (!emailSent) {
      return res.status(500).json({success: false, message: "Failed to send order confirmation email." });
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId: savedOrder._id,
    });

    
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: "An error occurred while placing the order. Please try again." });
  }
};


const codOrderSuccess = async (req, res) => {
  try { 
    const { orderId } = req.query;

    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    const order = await Order.findById(orderId); 

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
    console.error("Error retrieving order:", error);
    return res.status(500).json({ message: "An error occurred while fetching the order details." });
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
      existingReview, existingReview,
    });

  } catch (error) {
    
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

module.exports = {
  loadProductDetails,
  loadCart,
  addToCart,
  updateCartQuantity,
  deletFromCart,
  loadCheckout,
  updateDefaultAddress,
  codPlaceOrder,
  codOrderSuccess,
  loadReview,
  postReview,
};
