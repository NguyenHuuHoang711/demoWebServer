import React, { useState, useEffect } from 'react';
import { FaHeart, FaStar } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import '../../assets/css/productcard.css';

interface Product {
  _id: string;
  name: string;
  price: number;
  discount: number;
  rating: number;
  like_count: number;
  images: { image: string }[] | string[];
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const finalPrice = product.price - (product.price * product.discount) / 100;
  const [imageLoaded, setImageLoaded] = useState(false);

  const { data: likesData } = useQuery({
    queryKey: ['userLikes', product._id],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return { success: false, likes: [] };
      const res = await fetch('http://localhost:3001/api/v1/like-lists', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch likes');
      return res.json();
    },
    enabled: !!localStorage.getItem('token'),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (likesData?.success) {
      const liked = likesData.likes.some((like: any) =>
        like.product.some((p: any) => p._id === product._id)
      );
      setIsLiked(liked);
    }
  }, [likesData, product._id]);

  const likeMutation = useMutation({
    mutationFn: async ({ productId, isLiked }: { productId: string; isLiked: boolean }) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not logged in');
      const url = `http://localhost:3001/api/v1/like-lists/${productId}`;
      const method = isLiked ? 'DELETE' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! Status: ${res.status}, Response: ${text}`);
      }
      return res.json();
    },
    onMutate: async ({ isLiked }) => {
      setIsLiking(true);
      const previousIsLiked = isLiked;
      const previousLikeCount = likeCount;
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      await queryClient.cancelQueries({ queryKey: ['mostLikedProducts'] });
      return { previousIsLiked, previousLikeCount };
    },
    onSuccess: () => {
      setIsLiking(false);
        queryClient.invalidateQueries({ queryKey: ['mostLikedProducts'] });
        queryClient.invalidateQueries({ queryKey: ['userLikes'] });
    },
    onError: (err, _, context) => {
      setIsLiking(false);
      setIsLiked(context?.previousIsLiked ?? isLiked);
      setLikeCount(context?.previousLikeCount ?? likeCount);
      console.error('Lỗi khi thích/bỏ thích:', err);
      alert('Đã có lỗi xảy ra');
    },
  });

  const handleLike = () => {
    if (isLiking) return;
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    likeMutation.mutate({ productId: product._id, isLiked });
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FaStar key={i} className={i <= Math.round(rating) ? 'star filled' : 'star'} />
      );
    }
    return stars;
  };

  const getImageUrl = () => {
    if (!product.images || product.images.length === 0) {
      return 'https://via.placeholder.com/150?text=No+Image'; // Fallback nếu không có ảnh
    }
    const firstImage = product.images[0];
    if (typeof firstImage === 'string') {
      // Nếu là ID, cần fetch URL (giả định endpoint /api/v1/images/:id)
      console.warn('Image is ID, fetching URL might be needed:', firstImage);
      return `http://localhost:3001/api/v1/images/${firstImage}`; // Placeholder, cần API thực tế
    }
    return firstImage.image || 'https://via.placeholder.com/150?text=Error'; // Nếu là object
  };

  return (
    <div className="container">
      <div className="card">
        <div className="image-wrapper">
          <Link to={`/product-detail/${product._id}`}>
            <img
              src={getImageUrl()}
              alt={product.name}
              className="image"
              loading="lazy" // Lazy loading
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/150?text=Error'; // Fallback nếu lỗi
              }}
              style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
            />
            {!imageLoaded && <div className="image-placeholder">Đang tải...</div>}
          </Link>
          <div className="label">Hot</div>
        </div>
        <div className="rating-line">
          <span className="stars">{renderStars(product.rating)}</span>
          <span className="like-count">({likeCount} lượt thích)</span>
        </div>
        <div className="name">{product.name}</div>
        <div className="provider">
          By <span className="provider-name">NetFood</span>
        </div>
        <div className="price-line">
          {product.discount > 0 ? (
            <div>
              <span className="final-price">{finalPrice.toLocaleString('vi-VN')}₫</span>
              <span className="old-price">{product.price.toLocaleString('vi-VN')}₫</span>
            </div>
          ) : (
            <span className="final-price">{product.price.toLocaleString('vi-VN')}₫</span>
          )}
          <button
            className={`heart-btn ${isLiked ? 'liked' : ''} ${isLiking ? 'loading' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <FaHeart className="heart-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;