const Product = require('../models/Product');
const Category = require('../models/Category');
const Target = require('../models/Target');
const ProductColor = require('../models/ProductColor');
const ProductSizeStock = require('../models/ProductSizeStock');

class ProductController {
    // Lấy danh sách sản phẩm với phân trang và lọc
    async getProducts(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sort = '-createdAt',
                category,
                target,
                minPrice,
                maxPrice,
                search,
                isActivated = true
            } = req.query;

            // Xây dựng query
            const query = { isActivated };

            // Thêm điều kiện lọc
            if (category) query.categoryID = category;
            if (target) query.targetID = target;
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = minPrice;
                if (maxPrice) query.price.$lte = maxPrice;
            }
            if (search) {
                query.$text = { $search: search };
            }

            // Thực hiện query với phân trang
            const products = await Product.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('targetInfo')
                .populate('categoryInfo');
            //! PHAI DEM COLOR ID DE TRUY VAN QUA BANG SIZESTOCK LAY RA SIZE S , M , L
            // Lấy colors và sizes cho từng sản phẩm
            const productsWithDetails = await Promise.all(products.map(async (product) => {
                const colors = await ProductColor.find({ productID: product.productID });
                const colorsWithSizes = await Promise.all(colors.map(async (color) => {
                    const sizes = await ProductSizeStock.find({ colorID: color.colorID });
                    return {
                        ...color.toObject(),
                        sizes
                    };
                }));
                return {
                    ...product.toObject(),
                    colors: colorsWithSizes
                };
            }));

            // Đếm tổng số sản phẩm
            const total = await Product.countDocuments(query);

            res.json({
                products: productsWithDetails,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách sản phẩm',
                error: error.message
            });
        }
    }

    // Lấy danh sách sản phẩm cho ADMIN với prefetch
    async getProductsChoADMIN(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sort = '-createdAt',
                category,
                target,
                minPrice,
                maxPrice,
                search,
                isActivated,
                prefetch = false // Thêm option prefetch
            } = req.query;

            // Xây dựng query
            const query = {};
            if (typeof isActivated !== 'undefined') {
                query.isActivated = isActivated === 'true';
            }

            // Thêm điều kiện lọc
            if (category) query.categoryID = category;
            if (target) query.targetID = target;
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = minPrice;
                if (maxPrice) query.price.$lte = maxPrice;
            }
            if (search) {
                query.$text = { $search: search };
            }

            // Tính toán số lượng sản phẩm cần lấy
            const currentPage = parseInt(page);
            const itemsPerPage = parseInt(limit);
            const prefetchPages = prefetch ? 2 : 0; // Số trang muốn tải trước
            const totalItemsToFetch = itemsPerPage * (1 + prefetchPages); // Số items cần lấy (bao gồm cả prefetch)
            const skipItems = (currentPage - 1) * itemsPerPage;

            // Thực hiện query với prefetch
            const products = await Product.find(query)
                .select('productID name price thumbnail isActivated categoryID targetID createdAt')
                .sort(sort)
                .skip(skipItems)
                .limit(totalItemsToFetch)
                .populate('targetInfo', 'targetID name')
                .populate('categoryInfo', 'categoryID name');

            // Lấy colors và sizes cho từng sản phẩm (chỉ lấy thông tin cần thiết)
            const productsWithDetails = await Promise.all(products.map(async (product) => {
                const colors = await ProductColor.find({ productID: product.productID })
                    .select('colorID colorName colorCode');

                const colorsWithSizes = await Promise.all(colors.map(async (color) => {
                    const sizes = await ProductSizeStock.find({ colorID: color.colorID })
                        .select('size stock SKU');
                    return {
                        ...color.toObject(),
                        sizes: sizes.map(size => ({
                            size: size.size,
                            stock: size.stock,
                            SKU: size.SKU
                        }))
                    };
                }));

                return {
                    ...product.toObject(),
                    colors: colorsWithSizes
                };
            }));

            // Đếm tổng số sản phẩm
            const total = await Product.countDocuments(query);
            const totalPages = Math.ceil(total / itemsPerPage);

            // Chia dữ liệu thành current và prefetch
            const currentPageData = productsWithDetails.slice(0, itemsPerPage);
            const prefetchData = productsWithDetails.slice(itemsPerPage);

            res.json({
                products: currentPageData,
                prefetchedProducts: prefetch ? prefetchData : [], // Trả về dữ liệu prefetch nếu có yêu cầu
                total,
                totalPages,
                currentPage,
                hasMore: currentPage < totalPages,
                prefetchedPages: prefetch ? prefetchPages : 0
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách sản phẩm',
                error: error.message
            });
        }
    }

    // Lấy thông tin cơ bản của tất cả sản phẩm (không phân trang)
    async getAllProductsBasicInfo(req, res) {
        try {
            // Lấy tất cả sản phẩm đang hoạt động
            const products = await Product.find({ isActivated: true })
                .populate('targetInfo', 'name')
                .populate('categoryInfo', 'name');

            // Lấy thông tin về màu sắc và kích thước cho từng sản phẩm
            const productsWithDetails = await Promise.all(products.map(async (product) => {
                const colors = await ProductColor.find({ productID: product.productID });
                
                // Tính tổng số lượng tồn kho cho tất cả màu và size
                let totalStock = 0;
                for (const color of colors) {
                    const sizes = await ProductSizeStock.find({ colorID: color.colorID });
                    totalStock += sizes.reduce((sum, size) => sum + size.stock, 0);
                }

                // Tạo base URL cho ảnh
                const baseURL = `http://localhost:5000/public/uploads/products`;

                return {
                    _id: product._id,
                    productID: product.productID,
                    name: product.name,
                    price: product.price,
                    category: product.categoryInfo?.name,
                    target: product.targetInfo?.name,
                    thumbnail: product.thumbnail ? `${baseURL}/${product.thumbnail}` : null,
                    colorCount: colors.length,
                    totalStock,
                    inStock: totalStock > 0
                };
            }));

            res.json({
                success: true,
                products: productsWithDetails
            });
        } catch (error) {
            console.error('Error in getAllProductsBasicInfo:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy thông tin sản phẩm',
                error: error.message
            });
        }
    }

    // Lấy chi tiết sản phẩm theo ID
    async getProductById(req, res) {
        try {
            const { id } = req.params;
            
            // Lấy thông tin cơ bản của sản phẩm, sử dụng productID thay vì _id
            const product = await Product.findOne({ productID: id })
                .populate('targetInfo', 'name')
                .populate('categoryInfo', 'name');

            if (!product) {
                return res.status(404).json({
                    message: 'Không tìm thấy sản phẩm'
                });
            }

            // Lấy tất cả màu của sản phẩm
            const colors = await ProductColor.find({ productID: product.productID });
            
            // Tạo base URL cho ảnh
            const baseURL = `http://localhost:5000/public/uploads/products`;
            
            // Lấy thông tin size và tồn kho cho từng màu
            const colorsWithSizes = await Promise.all(colors.map(async (color) => {
                const sizes = await ProductSizeStock.find({ colorID: color.colorID })
                    .select('size stock');
                
                return {
                    colorID: color.colorID,
                    colorName: color.colorName,
                    // Thêm đường dẫn đầy đủ cho ảnh
                    images: color.images.map(img => `${baseURL}/${img}`),
                    sizes: sizes.map(size => ({
                        size: size.size,
                        stock: size.stock
                    }))
                };
            }));

            // Format lại dữ liệu trước khi gửi về client
            const formattedProduct = {
                _id: product._id,
                productID: product.productID,
                name: product.name,
                description: product.description,
                price: product.price,
                category: product.categoryInfo?.name,
                target: product.targetInfo?.name,
                // Thêm đường dẫn đầy đủ cho thumbnail
                thumbnail: product.thumbnail ? `${baseURL}/${product.thumbnail}` : null,
                colors: colorsWithSizes,
                // Tính toán các thông tin bổ sung
                totalStock: colorsWithSizes.reduce((total, color) => 
                    total + color.sizes.reduce((sum, size) => sum + size.stock, 0), 0),
                availableSizes: [...new Set(colorsWithSizes.flatMap(color => 
                    color.sizes.map(size => size.size)
                ))].sort(),
                availableColors: colorsWithSizes.map(color => color.colorName)
            };

            res.json({
                success: true,
                product: formattedProduct
            });
        } catch (error) {
            console.error('Error in getProductById:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy chi tiết sản phẩm',
                error: error.message
            });
        }
    }

    // Tạo sản phẩm mới
    async createProduct(req, res) {
        try {
            const {
                name,
                targetID,
                description,
                price,
                categoryID,
                thumbnail,
                colors,
                sizes
            } = req.body;

            // Kiểm tra target và category tồn tại
            const [target, category] = await Promise.all([
                Target.findOne({ targetID }),
                Category.findOne({ categoryID })
            ]);

            if (!target || !category) {
                return res.status(400).json({
                    message: 'Target hoặc Category không tồn tại'
                });
            }

            // Tạo ID mới cho sản phẩm
            const lastProduct = await Product.findOne().sort({ productID: -1 });
            const productID = lastProduct ? lastProduct.productID + 1 : 1;

            // Tạo sản phẩm mới
            const product = new Product({
                productID,
                name,
                targetID,
                description,
                price,
                categoryID,
                thumbnail
            });

            await product.save();

            // Thêm màu sắc và size cho sản phẩm
            if (colors && colors.length > 0) {
                const colorDocs = colors.map(color => ({
                    productID,
                    colorName: color.name,
                    colorCode: color.code,
                    images: color.images
                }));
                await ProductColor.insertMany(colorDocs);
            }

            if (sizes && sizes.length > 0) {
                const sizeDocs = sizes.map(size => ({
                    productID,
                    size: size.name,
                    stock: size.stock,
                    price: size.price || product.price
                }));
                await ProductSizeStock.insertMany(sizeDocs);
            }

            res.status(201).json({
                message: 'Tạo sản phẩm thành công',
                product: {
                    ...product.toJSON(),
                    colors,
                    sizes
                }
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi tạo sản phẩm',
                error: error.message
            });
        }
    }

    // Cập nhật sản phẩm
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Kiểm tra sản phẩm tồn tại
            const product = await Product.findOne({ productID: id });
            if (!product) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            // Nếu cập nhật target hoặc category, kiểm tra tồn tại
            if (updateData.targetID || updateData.categoryID) {
                const [target, category] = await Promise.all([
                    updateData.targetID ? Target.findOne({ targetID: updateData.targetID }) : Promise.resolve(true),
                    updateData.categoryID ? Category.findOne({ categoryID: updateData.categoryID }) : Promise.resolve(true)
                ]);

                if (!target || !category) {
                    return res.status(400).json({
                        message: 'Target hoặc Category không tồn tại'
                    });
                }
            }

            // Cập nhật thông tin sản phẩm
            Object.assign(product, updateData);
            await product.save();

            // Cập nhật màu sắc nếu có
            if (updateData.colors) {
                await ProductColor.deleteMany({ productID: id });
                if (updateData.colors.length > 0) {
                    const colorDocs = updateData.colors.map(color => ({
                        productID: id,
                        colorName: color.name,
                        colorCode: color.code,
                        images: color.images
                    }));
                    await ProductColor.insertMany(colorDocs);
                }
            }

            // Cập nhật size nếu có
            if (updateData.sizes) {
                await ProductSizeStock.deleteMany({ productID: id });
                if (updateData.sizes.length > 0) {
                    const sizeDocs = updateData.sizes.map(size => ({
                        productID: id,
                        size: size.name,
                        stock: size.stock,
                        price: size.price || product.price
                    }));
                    await ProductSizeStock.insertMany(sizeDocs);
                }
            }

            // Lấy sản phẩm đã cập nhật với đầy đủ thông tin
            const updatedProduct = await Product.findOne({ productID: id })
                .populate('targetInfo')
                .populate('categoryInfo')
                .populate('colors')
                .populate('sizes');

            res.json({
                message: 'Cập nhật sản phẩm thành công',
                product: updatedProduct
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật sản phẩm',
                error: error.message
            });
        }
    }

    // Xóa sản phẩm (soft delete)
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;

            const product = await Product.findOne({ productID: id });
            if (!product) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            // Soft delete bằng cách set isActivated = false
            product.isActivated = false;
            await product.save();

            res.json({ message: 'Xóa sản phẩm thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa sản phẩm',
                error: error.message
            });
        }
    }

    // Khôi phục sản phẩm đã xóa
    async restoreProduct(req, res) {
        try {
            const { id } = req.params;

            const product = await Product.findOne({ productID: id });
            if (!product) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            // Khôi phục bằng cách set isActivated = true
            product.isActivated = true;
            await product.save();

            res.json({ message: 'Khôi phục sản phẩm thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi khôi phục sản phẩm',
                error: error.message
            });
        }
    }

    // Lấy sản phẩm theo giới tính (Nam/Nữ)
    async getProductsByGender(req, res) {
        try {
            const {
                targetID, // ID target được gửi từ client
                page = 1,
                limit = 12,
                sort = '-createdAt',
                category,
                minPrice,
                maxPrice,
                search,
            } = req.query;

            // Xây dựng query với targetID từ client
            const query = { 
                isActivated: true,
                targetID: parseInt(targetID) // Chuyển targetID từ string sang number
            };

            // Thêm điều kiện lọc
            if (category && category !== 'Tất cả') {
                // Tìm categoryID từ tên category
                const categoryDoc = await Category.findOne({ name: category });
                if (categoryDoc) {
                    query.categoryID = categoryDoc.categoryID; // Sử dụng categoryID thay vì _id
                }
            }
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = parseInt(minPrice);
                if (maxPrice) query.price.$lte = parseInt(maxPrice);
            }
            if (search) {
                query.$text = { $search: search };
            }

            // Thực hiện query với phân trang
            const products = await Product.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('categoryInfo')
                .populate('targetInfo');

            // Lấy colors và sizes cho từng sản phẩm
            const productsWithDetails = await Promise.all(products.map(async (product) => {
                const colors = await ProductColor.find({ productID: product.productID });
                const colorsWithSizes = await Promise.all(colors.map(async (color) => {
                    const sizes = await ProductSizeStock.find({ colorID: color.colorID });
                    return {
                        ...color.toObject(),
                        sizes
                    };
                }));

                // Tính tổng số lượng tồn kho
                const totalStock = colorsWithSizes.reduce((total, color) => {
                    return total + color.sizes.reduce((sum, size) => sum + size.stock, 0);
                }, 0);

                return {
                    ...product.toObject(),
                    colors: colorsWithSizes,
                    inStock: totalStock > 0
                };
            }));

            // Đếm tổng số sản phẩm
            const total = await Product.countDocuments(query);

            res.json({
                products: productsWithDetails,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            });
        } catch (error) {
            console.error('Error in getProductsByGender:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách sản phẩm',
                error: error.message
            });
        }
    }
}

module.exports = new ProductController();