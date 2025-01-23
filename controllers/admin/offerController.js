const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');


const loadOffer = async(req, res) => {
    try {
        // Fetch active products
        const products = await Product.find({
          isBlocked: false,
          isDeleted: false,
          isListed: true,
        });
    
        // Fetch active categories
        const categories = await Category.find({
          isDeleted: false,
          isListed: true,
        });
    
        // Render the offers page with products and categories
        res.render('offers', {
          products: products,
          categories: categories,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
}

const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if any product in the category already has a higher offer
        const products = await Product.find({ category: category._id });
        const hasProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({
                success: false,
                message: 'Category already has a product offer'
            });
        }

        // Update category offer
        category.categoryOffer = percentage;
        await category.save();

        // Update products with the new offer
        for (const product of products) {
            product.productOffer = percentage;
            product.salePrice = product.regularPrice * (1 - percentage / 100);  // Apply discount
            await product.save();
        }

        return res.json({
            success: true,
            message: 'Category Offer Added Successfully'
        });
    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            message: 'Failed to Add Category Offer'
        });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        const categoryDoc = await Category.findById(categoryId);
        if (!categoryDoc) {
            return res.json({
                success: false,
                message: 'Category not found'
            });
        }

        // Reset category offer
        categoryDoc.categoryOffer = 0;
        await categoryDoc.save();

        // Reset offer on all products in the category
        const products = await Product.find({ category: categoryId });
        for (const product of products) {
            product.productOffer = 0;
            product.salePrice = product.regularPrice;  // Reset sale price
            await product.save();
        }

        return res.json({
            success: true,
            message: 'Category Offer Removed Successfully'
        });
    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            message: 'Failed to Remove Category Offer'
        });
    }
};

const addProductsOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.json({
                success: false,
                message: 'Product not found'
            });
        }

        // Apply the discount logic and save the product
        findProduct.salePrice = findProduct.regularPrice * (1 - percentage / 100);
        findProduct.productOffer = parseInt(percentage);

        if (findProduct.salePrice < 0) {
            return res.json({
                success: false,
                message: "Invalid percentage: The offer leads to a negative sale price. Please adjust the percentage.",
            });
        }

        await findProduct.save();
        return res.json({
            success: true,
            message: 'Product Offer Added Successfully'
        });
    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            message: 'Failed to Add Product Offer'
        });
    }
};



const removeProductsOffer = async (req, res) => {
    try {
        console.log('body: ', req.body);
        const { productId } = req.body;
        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.json({
                success: false,
                message: 'Product not found'
            });
        }

        // Reset sale price to regular price and remove offer
        findProduct.salePrice = findProduct.regularPrice;
        findProduct.productOffer = 0;

        await findProduct.save();
        return res.json({
            success: true,
            message: 'Product Offer Removed Successfully'
        });
    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            message: 'Failed to Remove Product Offer'
        });
    }
};




module.exports = {
    loadOffer,
    addCategoryOffer,
    removeCategoryOffer,
    addProductsOffer,
    removeProductsOffer
}