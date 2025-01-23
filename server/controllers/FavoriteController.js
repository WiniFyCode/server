const Favorite = require('../models/Favorite');
const ProductSizeStock = require('../models/ProductSizeStock');
const Product = require('../models/Product');
const ProductColor = require('../models/ProductColor');

class FavoriteController {
    // Lấy danh sách yêu thích của user
    async getFavorites(req, res) {
        try {
            const userID = req.user.userID;
            const { page = 1, limit = 10 } = req.query;

            // Lấy danh sách yêu thích với phân trang
            const favorites = await Favorite.find({ userID })
                .sort('-addedAt')
                .skip((page - 1) * limit)
                .limit(limit);

            // Lấy thông tin chi tiết sản phẩm
            const items = await Promise.all(favorites.map(async (fav) => {
                // Tìm thông tin ProductSizeStock
                const sizeStock = await ProductSizeStock.findOne({ SKU: fav.SKU });

                if (!sizeStock) {
                    return {
                        favoriteID: fav.favoriteID,
                        note: fav.note,
                        addedAt: fav.addedAt,
                        error: 'Sản phẩm không còn tồn tại'
                    };
                }

                // Parse productID và colorID từ SKU (format: productID_colorID_size_version)
                const [productID, colorID] = sizeStock.SKU.split('_');

                // Lấy thông tin sản phẩm và màu sắc
                const product = await Product.findOne({ productID: parseInt(productID) })
                    .populate('targetInfo')
                    .populate('categoryInfo');

                const color = await ProductColor.findOne({ 
                    productID: parseInt(productID),
                    colorID: parseInt(colorID)
                });
                
                return {
                    favoriteID: fav.favoriteID,
                    product: {
                        productID: product.productID,
                        name: product.name,
                        price: product.price,
                        imageURL: product.imageURL,
                        category: product.categoryInfo,
                        target: product.targetInfo
                    },
                    size: sizeStock.size,
                    color: color,
                    stock: sizeStock.stock,
                    note: fav.note,
                    addedAt: fav.addedAt
                };
            }));

            // Đếm tổng số item yêu thích
            const total = await Favorite.countDocuments({ userID });

            res.json({
                items,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách yêu thích',
                error: error.message
            });
        }
    }

    // Thêm sản phẩm vào danh sách yêu thích
    async addToFavorites(req, res) {
        try {
            const userID = req.user.userID;
            const { SKU, note = '' } = req.body;

            // Kiểm tra sản phẩm tồn tại
            const stockItem = await ProductSizeStock.findOne({ SKU });
            if (!stockItem) {
                return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
            }

            // Kiểm tra sản phẩm đã có trong danh sách yêu thích chưa
            const existingFavorite = await Favorite.findOne({ userID, SKU });
            if (existingFavorite) {
                return res.status(400).json({ message: 'Sản phẩm đã có trong danh sách yêu thích' });
            }

            // Tạo ID mới cho favorite
            const lastFavorite = await Favorite.findOne().sort({ favoriteID: -1 });
            const favoriteID = lastFavorite ? lastFavorite.favoriteID + 1 : 1;

            // Thêm vào danh sách yêu thích
            const favorite = new Favorite({
                favoriteID,
                userID,
                SKU,
                note
            });

            await favorite.save();

            res.status(201).json({
                message: 'Thêm vào danh sách yêu thích thành công',
                favorite
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi thêm vào danh sách yêu thích',
                error: error.message
            });
        }
    }

    // Cập nhật ghi chú cho sản phẩm yêu thích
    async updateFavorite(req, res) {
        try {
            const userID = req.user.userID;
            const { id } = req.params;
            const { note } = req.body;

            const favorite = await Favorite.findOne({ favoriteID: id, userID });
            if (!favorite) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong danh sách yêu thích' });
            }

            favorite.note = note;
            await favorite.save();

            res.json({
                message: 'Cập nhật ghi chú thành công',
                favorite
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật ghi chú',
                error: error.message
            });
        }
    }

    // Xóa sản phẩm khỏi danh sách yêu thích
    async removeFromFavorites(req, res) {
        try {
            const userID = req.user.userID;
            const { id } = req.params;

            const favorite = await Favorite.findOne({ favoriteID: id, userID });
            if (!favorite) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong danh sách yêu thích' });
            }

            await favorite.deleteOne();

            res.json({ message: 'Xóa khỏi danh sách yêu thích thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa khỏi danh sách yêu thích',
                error: error.message
            });
        }
    }

    // Kiểm tra sản phẩm có trong danh sách yêu thích không
    async checkFavorite(req, res) {
        try {
            const userID = req.user.userID;
            const { SKU } = req.params;

            const favorite = await Favorite.findOne({ userID, SKU });

            res.json({
                isFavorite: !!favorite,
                favorite
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi kiểm tra trạng thái yêu thích',
                error: error.message
            });
        }
    }
}

module.exports = new FavoriteController();
