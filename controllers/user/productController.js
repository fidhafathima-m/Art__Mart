const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Review = require("../../models/reviewSchema");
const Cart = require("../../models/cartSchema");
const mongoose = require("mongoose");

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
      cartItems: cartItems

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


module.exports = {
  loadProductDetails,
  loadCart,
  addToCart,
  updateCartQuantity,
  deletFromCart,
};
