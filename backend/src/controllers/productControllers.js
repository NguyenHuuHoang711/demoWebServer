const Product = require('../models/Product.js');
const ApplicableProduct = require('../models/ApplicableProduct');
const Images = require('../models/Image.js');
const LikeList = require('../models/LikeList.js');
const Categories = require('../models/Category.js');
const logger = require('../utils/logger.js');
const { log } = require('winston');
const client = require('../config/meiliSearchConfig'); // Import the MeiliSearch client


const createProduct = async (req, res) => {
  try {
    console.log('📥 Đã nhận file:', req.files); 
    logger.info('Creating product with data:', req.body);

    const { name, price, categories, description, discount, quantity, images } = req.body;

    // ✅ Validate các trường bắt buộc
    if (!name || !price || !categories || !description || !discount || !quantity) {
      return res.status(400).json({
        success: false,
        message:
          'please provide all required fields: name, price, categories, description, discount, quantity',
      });
    }

    // ✅ Parse lại dữ liệu số nếu bị gửi dưới dạng chuỗi
    const newProduct = await Product.create({
      name,
      price: Number(price),
      categories, // MongoDB sẽ tự cast sang ObjectId nếu đúng
      description,
      discount: Number(discount),
      quantity: Number(quantity),
      images: [],
    });

    let imageIds = [];

    // ✅ Ảnh từ file upload
    if (req.files && req.files.length > 0) {
      const uploadedImages = await Promise.all(
        req.files.map(async (file) => {
          const img = await Images.create({
            image: `/uploads/products/${file.filename}`,
            Product: newProduct._id,
          });
          return img._id;
        })
      );
      imageIds = imageIds.concat(uploadedImages);
    }

    // ✅ Ảnh từ URL/link
    if (images) {
      const urls = Array.isArray(images) ? images : [images];
      const linkImages = await Promise.all(
        urls.map(async (url) => {
          const img = await Images.create({
            image: url,
            Product: newProduct._id,
          });
          return img._id;
        })
      );
      imageIds = imageIds.concat(linkImages);
    }

    newProduct.images = imageIds;
    await newProduct.save();

    logger.info(`Product created successfully: ${newProduct._id}`);
    res.status(201).json({
      success: true,
      data: newProduct,
    });
  } catch (e) {
    logger.error('Error creating product:', e.message);
    res.status(500).json({
      success: false,
      message: e.message,
    });
  }
};


const getAllProducts = async (req, res) => {
    try {
        logger.info('Fetching all products')
        const products = await Product.find().populate('images', 'image').populate('categories');
      
        logger.info(`Retrieved ${products.length} products`);
        res.status(200).json({
            success: true,
            message: 'get all products successfully',
            products: products
        })
    } catch (e) {
        logger.error(`Error fetching products: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message 
        })
    }
};

const getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    logger.info(`Fetching product with ID: ${productId}`);

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID sản phẩm.',
      });
    }

    const product = await Product.findById(productId)
      .populate('images')
      .populate('categories');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm',
      });
    }

    const now = new Date();

    const applicableEvent = await ApplicableProduct.findOne({
      productId: product._id,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

console.log("Kết quả applicableEvent:", applicableEvent);

    const eventDiscount = applicableEvent ? parseInt(applicableEvent.discount) : 0;
    const isInEvent = !!applicableEvent;
    logger.info(`Product retrieved successfully: ${product._id}`);

    return res.status(200).json({
      success: true,
      data: {
        ...product._doc,
        eventDiscount,
        isInEvent,
      },
    });
  } catch (error) {
    logger.error(`Error fetching product: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin sản phẩm',
    });
  }
};

// const updateProduct = async (req, res) => {
//   try {
//     const product = req.params.id;

//     const { name, price, description, category, images } = req.body;

//     // Nếu images là chuỗi (do từ form-data), parse JSON
//     if (typeof images === 'string') {
//       images = JSON.parse(images);
//     }

//       const existingEvent = await Product.findById(req.params.id);
//       if (!existingEvent) {
//         logger.warn(`Event not found with ID: ${req.params.id}`);
//          return res.status(404).json({ success: false, message: 'Event not found' });
//       }
        
//            // Ảnh từ link (chuỗi URL)
// let imageLinks = [];
// if (req.body.image) {
//   if (Array.isArray(req.body.image)) {
//     imageLinks = req.body.image.filter((img) => typeof img === 'string');
//   } else if (typeof req.body.image === 'string') {
//     imageLinks = [req.body.image];
//   }
// }

// // Ảnh từ file upload
// let uploadedFiles = [];
// if (req.files && req.files.length > 0) {
//   uploadedFiles = req.files.map((file) => `/uploads/products/${file.filename}`);
// }

// // Gộp ảnh mới (link + file)
// const newImages = [...imageLinks, ...uploadedFiles];

// // Gộp với ảnh cũ, bỏ trùng
// const finalImages = Array.from(new Set([...existingEvent.image, ...newImages]));

// console.log('req.files:', req.files);
// console.log('req.body.image:', req.body.image);

//     const updateProduct = await Product.findByIdAndUpdate(
//             product, 
//             { 
//                 name, 
//                 price, 
//                 description, 
//                 category,
//                 image: finalImages, 
//             }, 
//             { new: true });

//     res.json({ success: true, updateProduct });
//   } catch (err) {
//     console.error('❌ Error updating product:', err);
//     res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm' });
//   }
// };

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      name,
      description,
      price,
      quantity,
      discount,
      category,
    } = req.body;

    // Tìm sản phẩm hiện tại
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

        // Ảnh từ link (chuỗi URL)
    let imageLinks = [];
    if (req.body.image) {
      if (Array.isArray(req.body.image)) {
        imageLinks = req.body.image.filter((img) => typeof img === 'string');
      } else if (typeof req.body.image === 'string') {
        imageLinks = [req.body.image];
      }
    }
    
    // Xử lý ảnh mới (nếu có)
    let newImageIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const newImage = new Images({
          image: `/uploads/products/${file.filename}`,
        });
        await newImage.save();
        newImageIds.push(newImage._id);
      }
    }

    // Gộp ảnh cũ và ảnh mới
    product.images = [...product.images, ...newImageIds];

    // Cập nhật các trường khác
    product.name = name;
    product.description = description;
    product.price = price;
    product.quantity = quantity;
    product.discount = discount;
    product.category = category;

    await product.save();

    res.status(200).json({ message: 'Cập nhật sản phẩm thành công', product });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm' });
  }
};
const deleteProduct = async (req, res) => {
    try {
        logger.info(`Deleting product with ID: ${req.params.id}`);
        if (!req.params.id) {
            logger.warn('Product ID is required for deletion');
            return res.status(400).json({
                success: false,
                message: 'please provide product ID to delete'
            });
        }

        logger.info(`Attempting to delete product with ID: ${req.params.id}`);
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) return res.status(404).json({
            success: false,
            message: 'product not found'
        });

        logger.info(`Product deleted successfully: ${product._id}`);
        res.json({product});
    } catch (e) {
        logger.error(`Error deleting product: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message
        });
    }
}

const like_count = async (req, res) => {
    try {
        
        logger.info(`Liking product with ID: ${req.params.id}`);
        if (!req.params.id) {
            logger.warn('Product ID is required for liking');
            return res.status(400).json({
                success: false,
                message: 'please provide product ID to like'
            });
        }

        logger.info(`User ID liking product: ${req.user.id}`);
        if (!req.user || !req.user.id) {
            logger.warn('User not authenticated');
            return res.status(401).json({
                success: false,
                message: 'please login to like this product'
            });
        }

        const likeList = await LikeList.findOne({ user: req.user._id, product: {$in :[req.params.id]} });
        const product = await Product.findById(req.params.id);
        console.log("   " + product._id, req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'product not found'
            });
        }

        logger.info(`Checking if user has already liked product: ${product._id}`);
        if (likeList) {
            logger.warn(`User has already liked this product: ${req.user.id}`);
            return res.status(400).json({
                success: false,
                message: 'you have already liked this product'
            });
        }
        
        if (!likeList) {
            logger.info(`Creating new like list for user: ${req.user.id}`);
            const newLikeList = await LikeList.create({
                user: req.user.id,
                product: [req.params.id]
            });
        }
        else {
            logger.info(`Adding product to existing like list for user: ${req.user.id}`);
            likeList.product.push(req.params.id);
            await likeList.save();
        }
      
        product.like_count += 1;
        await product.save();

        logger.info(`Product liked successfully: ${product._id}`);
        res.json({
            success: true,
            message: 'updated like count successfully',
            like_count: product.like_count
        });
        
       
    } catch (e) {
        logger.error(`Error liking product: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message
        });
    }
}

const view_count = async (req, res) => {
    try {
        logger.info(`Viewing product with ID: ${req.params.id}`);
        if (!req.params.id) {
            logger.warn('Product ID is required for viewing');
            return res.status(400).json({
                success: false,
                message: 'please provide product ID to view'
            });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'product not found'
            });
        }
        product.view_count += 1;
        await product.save();

        logger.info(`Product viewed successfully: ${product._id}`);
        res.json({
            success: true,
            message: 'updated view count successfully',
            view_count: product.view_count
        });
    } catch (e) {
        logger.error(`Error viewing product: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message
        });
    }
}

const sell_count = async (req, res) => {
    try {
        logger.info(`Updating sell count for product with ID: ${req.params.id}`);
        if (!req.params.id) {
            logger.warn('Product ID is required for updating sell count');
            return res.status(400).json({
                success: false,
                message: 'please provide product ID to update sell count'
            });
        }
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'product not found'
            });
        }
        if (product.sell_count >= product.quantity) {
            return res.status(400).json({
                success: false,
                message: 'product is out of stock'
            });
        }
        product.sell_count += 1;
        await product.save();

        logger.info(`Sell count updated successfully for product: ${product._id}`);
        res.json({
            success: true,
            message: 'updated sell count successfully',
            sell_count: product.sell_count
        });
    } catch (e) {
        logger.error(`Error updating sell count: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message
        });
    }
}

const searchProducts = async (req, res) => {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

  try {
    logger.info(`Searching products with query: ${query}`);
    if (!query) {
      logger.warn('Search query is empty');
      return res.status(400).json({
        success: false,
        message: 'Please provide a search keyword'
      });
    }
    const result = await client.index('products').search(query, {
        limit,
        offset
    });
    res.status(200).json({
        success: true,
        message: 'Product search successful',
        total: result.estimatedTotalHits,
        page,
        limit,
        results: result.hits
    });
  } catch (error) {
    res.status(500).json({
        success: false,
        message: 'Unable to search for products',
        error: error.message
    });
  }
};

const getProductByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu categoryId',
      });
    }

    const products = await Product.find({ categories: categoryId }).populate('images');

    res.status(200).json({
      success: true,
      message: 'Lấy sản phẩm theo danh mục thành công',
      data: products,
    });
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm theo danh mục:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message,
    });
  }
};

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    getProductByCategory,
    updateProduct,
    deleteProduct,
    like_count,
    view_count,
    sell_count,
    searchProducts
};
