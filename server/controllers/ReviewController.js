const Review = require('../models/Review');
const Product = require('../models/Product');

class ReviewController {
    // Tạo đánh giá mới
    async create(req, res) {
        try {
            const { productID, rating, comment, images } = req.body;
            const userID = req.user.userID; // Lấy từ middleware auth

            // Kiểm tra sản phẩm tồn tại
            const product = await Product.findOne({ productID });
            if (!product) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            // Kiểm tra user đã đánh giá sản phẩm này chưa
            const existingReview = await Review.findOne({ userID, productID });
            if (existingReview) {
                return res.status(400).json({ message: 'Bạn đã đánh giá sản phẩm này rồi' });
            }

            // Tạo review mới
            const review = await Review.create({
                userID,
                productID,
                rating,
                comment,
                images: images || [],
                createdAt: new Date()
            });

            // Cập nhật rating trung bình của sản phẩm
            const allReviews = await Review.find({ productID });
            const avgRating = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
            
            await Product.findOneAndUpdate(
                { productID },
                { 
                    rating: avgRating.toFixed(1),
                    totalReviews: allReviews.length
                }
            );

            res.status(201).json({
                message: 'Đánh giá sản phẩm thành công',
                review
            });

        } catch (error) {
            console.error('Error in create review:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi tạo đánh giá',
                error: error.message
            });
        }
    }

    // Cập nhật đánh giá
    async update(req, res) {
        try {
            const { reviewID } = req.params;
            const { rating, comment, images } = req.body;
            const userID = req.user.userID;

            // Kiểm tra review tồn tại và thuộc về user
            const review = await Review.findOne({ reviewID, userID });
            if (!review) {
                return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
            }

            // Cập nhật review
            const updatedReview = await Review.findOneAndUpdate(
                { reviewID },
                {
                    rating,
                    comment,
                    images: images || review.images,
                    updatedAt: new Date()
                },
                { new: true }
            );

            // Cập nhật rating trung bình của sản phẩm
            const allReviews = await Review.find({ productID: review.productID });
            const avgRating = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
            
            await Product.findOneAndUpdate(
                { productID: review.productID },
                { rating: avgRating.toFixed(1) }
            );

            res.json({
                message: 'Cập nhật đánh giá thành công',
                review: updatedReview
            });

        } catch (error) {
            console.error('Error in update review:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật đánh giá',
                error: error.message
            });
        }
    }

    // Xóa đánh giá
    async delete(req, res) {
        try {
            const { reviewID } = req.params;
            const userID = req.user.userID;

            // Kiểm tra review tồn tại và thuộc về user
            const review = await Review.findOne({ reviewID, userID });
            if (!review) {
                return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
            }

            // Lưu productID trước khi xóa review
            const productID = review.productID;

            // Xóa review
            await Review.findOneAndDelete({ reviewID });

            // Cập nhật rating trung bình của sản phẩm
            const allReviews = await Review.find({ productID });
            const avgRating = allReviews.length > 0
                ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
                : 0;
            
            await Product.findOneAndUpdate(
                { productID },
                { 
                    rating: avgRating.toFixed(1),
                    totalReviews: allReviews.length
                }
            );

            res.json({ message: 'Xóa đánh giá thành công' });

        } catch (error) {
            console.error('Error in delete review:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa đánh giá',
                error: error.message
            });
        }
    }

    // Lấy đánh giá của sản phẩm
    async getByProduct(req, res) {
        try {
            const { productID } = req.params;
            const { page = 1, limit = 10, sort = 'newest' } = req.query;

            // Kiểm tra sản phẩm tồn tại
            const product = await Product.findOne({ productID });
            if (!product) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
            }

            // Tạo query options
            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: sort === 'newest' ? { createdAt: -1 } : { rating: -1 },
                populate: {
                    path: 'userID',
                    select: 'fullname avatar'
                }
            };

            // Lấy reviews
            const reviews = await Review.paginate({ productID }, options);

            res.json({
                message: 'Lấy danh sách đánh giá thành công',
                reviews: reviews.docs,
                totalPages: reviews.totalPages,
                currentPage: reviews.page,
                totalReviews: reviews.totalDocs
            });

        } catch (error) {
            console.error('Error in get reviews by product:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách đánh giá',
                error: error.message
            });
        }
    }

    // Lấy đánh giá của user
    async getByUser(req, res) {
        try {
            const userID = req.user.userID;
            const { page = 1, limit = 10 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Lấy danh sách đánh giá
            const reviews = await Review.find({ userID })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            // Lấy thông tin sản phẩm
            const formattedReviews = await Promise.all(reviews.map(async (review) => {
                const product = await Product.findOne({ productID: review.productID });
                return {
                    reviewID: review.reviewID,
                    rating: review.rating,
                    comment: review.comment,
                    createdAt: review.createdAt,
                    productInfo: product ? {
                        name: product.name,
                        image: product.images ? product.images[0] : null,
                        price: product.price
                    } : {
                        name: 'Sản phẩm không còn tồn tại',
                        image: null,
                        price: 0
                    }
                };
            }));

            // Đếm tổng số đánh giá
            const totalReviews = await Review.countDocuments({ userID });

            res.json({
                message: 'Lấy danh sách đánh giá thành công',
                reviews: formattedReviews,
                totalPages: Math.ceil(totalReviews / parseInt(limit)),
                currentPage: parseInt(page),
                totalReviews
            });

        } catch (error) {
            console.error('Error in get reviews by user:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách đánh giá',
                error: error.message
            });
        }
    }

    // Admin: Lấy tất cả đánh giá
    async getAll(req, res) {
        try {
            const { page = 1, limit = 10, sort = 'newest' } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: sort === 'newest' ? { createdAt: -1 } : { rating: -1 },
                populate: [
                    {
                        path: 'userID',
                        select: 'fullname email'
                    },
                    {
                        path: 'productID',
                        select: 'name images'
                    }
                ]
            };

            const reviews = await Review.paginate({}, options);

            res.json({
                message: 'Lấy danh sách đánh giá thành công',
                reviews: reviews.docs,
                totalPages: reviews.totalPages,
                currentPage: reviews.page,
                totalReviews: reviews.totalDocs
            });

        } catch (error) {
            console.error('Error in get all reviews:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách đánh giá',
                error: error.message
            });
        }
    }

    // Admin: Xóa đánh giá
    async adminDelete(req, res) {
        try {
            const { reviewID } = req.params;

            // Kiểm tra review tồn tại
            const review = await Review.findOne({ reviewID });
            if (!review) {
                return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
            }

            // Lưu productID trước khi xóa review
            const productID = review.productID;

            // Xóa review
            await Review.findOneAndDelete({ reviewID });

            // Cập nhật rating trung bình của sản phẩm
            const allReviews = await Review.find({ productID });
            const avgRating = allReviews.length > 0
                ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
                : 0;
            
            await Product.findOneAndUpdate(
                { productID },
                { 
                    rating: avgRating.toFixed(1),
                    totalReviews: allReviews.length
                }
            );

            res.json({ message: 'Xóa đánh giá thành công' });

        } catch (error) {
            console.error('Error in admin delete review:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa đánh giá',
                error: error.message
            });
        }
    }
}

module.exports = new ReviewController();
