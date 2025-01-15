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
    // Fetch product details for the ordered items
    const productIds = order.ordereditems.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } }); // Assuming you have a Product model

    // Create a map of product IDs to product names
    const productMap = {};
    products.forEach(product => {
      productMap[product._id] = product.productName; // Assuming productName is the field for the name
    });

    // Construct an HTML list of items with product names
    const orderedItems = order.ordereditems.map(item => 
      `<li>${productMap[item.product]} (Qty: ${item.quantity}) - ₹${item.price}</li>`
    ).join(""); 

    const totalAmount = order.finalAmount; // Total price to pay
    const paymentMethod = "Cash on Delivery (COD)"; // Payment method is COD in your case

    // Create the delivery address section
    const deliveryAddress = `
      <p><b>Delivery Address:</b></p>
      <p>${defaultAddress.name}</p>
      <p>${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.pincode}</p>
      <p>Phone: ${defaultAddress.phone}</p>
      ${defaultAddress.altPhone ? `<p>Alternate Phone: ${defaultAddress.altPhone}</p>` : ""}
    `;

    // Create email content
    const emailContent = `
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

    return info.accepted.length > 0; // Check if email was accepted
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
            $nin: [...relatedProductIds, product._id], // Exclude both related products and the currently viewed product
          },
          isBlocked: false,
          isDeleted: false,
        },
      },
      {
        $sample: { size: 4 }, // Randomly sample 4 products
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
    
    // If the cart doesn't exist for the user, return an empty cart
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
    const userId = req.session.user; // Assuming you have the user ID from the session or JWT
    // Fetch the user's data
    const userData = await User.findOne({ _id: userId });
    
    // Fetch the user's cart, and populate product details, including stock quantity
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: Product,
    });

    // If cart does not exist, return an empty cart (or redirect to a different page)
    if (!cart) {
      return res.render("cart", {
        cartItems: [],
        subtotal: 0,
        user: userData,
        activePage: 'shop'
      });
    }

    // Extract cart items with product details and available stock quantity
    const cartItems = cart.items.map(item => ({
      productName: item.productId.productName,
      productImage: item.productId.productImage,
      cartQuantity: item.quantity,  // Cart quantity
      productStock: item.productId.quantity, // Product available stock quantity
      salePrice: item.productId.salePrice,
      productOffer: item.productId.productOffer,
      productId: item.productId._id, // Make sure product ID is passed to JS for future updates
    }));

    // Calculate subtotal
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += item.salePrice * item.cartQuantity;
    });

    // Render the cart page with the data
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
    const userId = req.session.user; // Assuming userId is stored in session

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to add items to the cart.'
      });
    }

    // Get the product ID from the query string
    const productId = req.body.productId; // Assuming you are passing the product ID in the URL like ?id=...
    
    // Fetch the product using the productId
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Fetch the user's cart or create a new one if it doesn't exist
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If cart doesn't exist, create a new cart
      cart = new Cart({
        userId,
        items: [
          {
            productId: product._id,
            quantity: 1,  // Default to 1 for new products
            price: product.salePrice,
            totalPrice: product.salePrice * 1, // Default total price for one item
            status: 1, // Assuming 1 means active
            cancellationReason: 0, // Placeholder for cancellation reason
          },
        ],
      });
    } else {
      // If cart exists, check if product is already in the cart
      const productIndex = cart.items.findIndex(item => item.productId.toString() === product._id.toString());

      if (productIndex === -1) {
        // If product is not in cart, add it
        cart.items.push({
          productId: product._id,
          quantity: 1, // Default to 1 for new products
          price: product.salePrice,
          totalPrice: product.salePrice * 1, // Default total price for one item
          status: 1, // Assuming 1 means active
          cancellationReason: 0, // Placeholder for cancellation reason
        });
      } else {
        // If product is already in cart, update the quantity
        cart.items[productIndex].quantity += 1;
        cart.items[productIndex].totalPrice = cart.items[productIndex].price * cart.items[productIndex].quantity;
      }
    }

    // Save the cart
    await cart.save();

    // Redirect the user to the cart page or another page as needed
    res.json({ success: true, message: "Item added to cart" }); // Redirect to cart page after adding the product

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error adding item to cart');
  }
}

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;  // Assuming user authentication
    const product = await Product.findOne({_id: productId});

    if (quantity > 5) {
      return res.status(400).json({ success: false, message: 'Cannot add more than 5 of this product.' });
    }

    // Find the cart for the user
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If the cart doesn't exist, create a new one
      cart = await Cart.create({
        userId,
        items: [{
          productId,
          quantity,
          price: product.salePrice/* Fetch the product price from the Product model */,
          totalPrice: product.salePrice * quantity/* Calculate total price based on quantity and price */,
          status: 1, // or whatever status you want to set
          cancellationReason: null, // or whatever default value you want
        }],
      });
    } else {
      // Find the item in the cart
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

      if (itemIndex > -1) {
        // If the item exists, update the quantity
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity; // Update total price
      } else {
        // If the item doesn't exist, add it to the cart
        const productPrice = product.salePrice/* Fetch the product price from the Product model */;
        cart.items.push({
          productId,
          quantity,
          price: productPrice,
          totalPrice: productPrice * quantity,
          status: 1,
          cancellationReason: null,
        });
      }
      await cart.save(); // Save the updated cart
    }

    // Return a success response with updated cart items
    const updatedCartItems = await Cart.find({ userId });

    res.json({
      success: true,
      updatedCartItems,  // Optionally return the updated cart items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

const deleteItem = async function(userId, productId) {
  try {
    // Find the cart by userId
    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Remove the item with matching productId from the cart's items array
    const updatedCart = await Cart.updateOne(
      { userId: userId },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } }
    );

    // Return true if modification was successful
    return updatedCart.modifiedCount > 0;
  } catch (error) {
    console.error('Error deleting item from cart:', error);
    return false;
  }
};

const deletFromCart = async (req, res) => {
  const productId = req.params.productId;
  const userId = req.session.user; // Get the userId from session (ensure user is logged in)
  

  try {
    // Call the deleteItem method from the Cart model
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

    // Fetch user's cart
    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
    
    // Fetch user's address document
    const userAddress = await Address.findOne({ userId: userId }).select('address');
    
    // Extract the default address from the address array
    const defaultAddress = userAddress ? userAddress.address.find(addr => addr.isDefault) : null;

    // If no default address, log it or handle accordingly
    if (!defaultAddress) {
      console.log('No default address found for the user.');
    }

    // If the cart doesn't exist for the user, return an empty cart
    const cartItems = cart ? cart.items : [];

    // Render checkout page with the extracted default address
    res.render('checkout', {
      activePage: 'shop',
      user: userId,
      cartItems: cartItems,
      addresses: userAddress ? userAddress.address : [],  // Pass all addresses for the modal
      defaultAddress: defaultAddress || {}  // Pass the default address (if any)
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

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User is not authenticated' });
    }

    // Step 1: Set all addresses' isDefault to false
    await Address.updateMany(
      { userId: userId },
      { $set: { "address.$[].isDefault": false } }
    );

    // Step 2: Set the selected address as the default
    const updatedAddress = await Address.updateOne(
      { userId: userId, "address._id": addressId },
      { $set: { "address.$.isDefault": true } }
    );

    // If no address was updated, return an error
    if (updatedAddress.nModified === 0) {
      return res.status(400).json({ success: false, message: 'Address not found or already set as default' });
    }

    // Successfully updated default address
    res.status(200).json({ success: true, message: 'Default address updated successfully' });
  } catch (error) {
    console.error('Error updating default address:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const codPlaceOrder = async (req, res) => {
  try {

    // Extract the order details from the request body
    const { ordereditems, totalprice, finalAmount, address, discount, status, couponApplied } = req.body;

    // Assuming user information is available (e.g., from session or JWT)
    const userId = req.session.user; // User ID from session or JWT

    // Fetch the address for the user from the Address model
    const userAddresses = await Address.find({ userId: userId });

    // Check if the user has addresses
    if (!userAddresses || userAddresses.length === 0) {
      return res.status(400).json({success: false, message: "No addresses found for the user" });
    }

    // Find the default address (where isDefault: true)
    const defaultAddress = userAddresses
      .flatMap(addr => addr.address) // Flatten the address array to get all addresses
      .find(addr => addr.isDefault === true);

    // If no default address exists, return an error
    if (!defaultAddress) {
      return res.status(400).json({success: false, message: "No default address found" });
    }


    // Proceed with creating the order using the default address
    const newOrder = new Order({
      ordereditems,
      totalprice,
      finalAmount,
      address: defaultAddress._id, // Use the default address's _id
      status: status || "Pending", // Default status is "Pending"
      createdOn: new Date(),
      invoiceDate: new Date(),
      couponApplied,
      discount,
    });


    // Save the order to the database
    const savedOrder = await newOrder.save();
    // console.log('saved data id: ', savedOrder._id);

    // Update Product Quantity
    for (const item of ordereditems) {
      const productId = item.product;
      const orderedQuantity = item.quantity;

      // Find the product and update its quantity
      const product = await Product.findById(productId);
      if (product) {
        // Ensure sufficient quantity is available
        if (product.quantity < orderedQuantity) {
          return res.status(400).json({ success: false, message: `Not enough stock for product ${product.productName}` });
        }
        // Deduct the quantity
        product.quantity -= orderedQuantity;
        await product.save();
      }
    }

    // Remove items from Cart
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { items: { productId: { $in: ordereditems.map(item => item.product) } } } }
    );

    const userData = await User.findOne({_id: userId});

    const userEmail = userData.email; // Ensure you have user email in session or order details
    console.log('user email: ', userEmail);
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
    console.log('Query parameters:', req.query);
    const { orderId } = req.query;

    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });

    const cartItems = cart ? cart.items : [];

    const order = await Order.findById(orderId); 
    console.log('Populated Order:', order);


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
};
