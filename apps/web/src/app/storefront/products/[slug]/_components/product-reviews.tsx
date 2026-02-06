'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge, Spinner } from '@platform/ui';
import { ThumbsUp, ThumbsDown, Star, Filter, ChevronDown, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { reviewsApi, Review, ReviewsResponse } from '@/lib/reviews-api';
import { formatCurrency } from '../../../_lib/format';
import { WriteReview } from './write-review';

interface ProductReviewsProps {
  productId: string;
  productSlug: string;
}

type SortOption = 'helpful' | 'newest' | 'highest' | 'lowest';

export function ProductReviews({ productId, productSlug }: ProductReviewsProps) {
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('helpful');
  const [currentPage, setCurrentPage] = useState(1);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [votedReviews, setVotedReviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReviews();
  }, [productId, selectedRating, sortBy, currentPage]);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      const data = await reviewsApi.getProductReviews(productId, {
        page: currentPage,
        limit: 10,
        rating: selectedRating || undefined,
        sortBy,
      });
      setReviewsData(data);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (reviewId: string, isHelpful: boolean) => {
    if (votedReviews.has(reviewId)) return;

    try {
      await reviewsApi.voteReview(reviewId, isHelpful);
      setVotedReviews(new Set([...votedReviews, reviewId]));
      // Refresh reviews to show updated counts
      await loadReviews();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleReviewSubmitted = () => {
    setShowWriteReview(false);
    loadReviews();
  };

  if (isLoading && !reviewsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!reviewsData) return null;

  const { reviews, pagination, ratingDistribution } = reviewsData;
  const totalReviews = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
  const averageRating = totalReviews > 0
    ? Object.entries(ratingDistribution).reduce((acc, [rating, count]) => acc + (Number(rating) * count), 0) / totalReviews
    : 0;

  return (
    <div className="space-y-8">
      {/* Overall Rating Summary */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-8 md:grid-cols-[300px_1fr]">
          {/* Average Rating */}
          <div className="space-y-4 text-center">
            <div>
              <div className="text-5xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
              <div className="mt-2 flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(averageRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <Button
              onClick={() => setShowWriteReview(true)}
              className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              Write a Review
            </Button>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Rating Breakdown</h3>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingDistribution[rating as keyof typeof ratingDistribution] || 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

              return (
                <button
                  key={rating}
                  onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50 ${
                    selectedRating === rating ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-1 text-sm font-medium text-slate-700 w-16">
                    {rating} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm text-slate-500">{count}</div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {selectedRating ? `${selectedRating} star reviews` : 'All reviews'}
          </span>
          {selectedRating && (
            <button
              onClick={() => setSelectedRating(null)}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Sort by:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="helpful">Most Helpful</option>
              <option value="newest">Newest</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">
            {selectedRating
              ? `No ${selectedRating} star reviews yet.`
              : 'No reviews yet. Be the first to review this product!'}
          </p>
          {!selectedRating && (
            <Button
              onClick={() => setShowWriteReview(true)}
              className="mt-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
            >
              Write the First Review
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onVote={handleVote}
              hasVoted={votedReviews.has(review.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={currentPage === pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Write Review Modal */}
      {showWriteReview && (
        <WriteReview
          productId={productId}
          productSlug={productSlug}
          onClose={() => setShowWriteReview(false)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
}

interface ReviewCardProps {
  review: Review;
  onVote: (reviewId: string, isHelpful: boolean) => void;
  hasVoted: boolean;
}

function ReviewCard({ review, onVote, hasVoted }: ReviewCardProps) {
  const [showAllImages, setShowAllImages] = useState(false);
  const displayImages = showAllImages ? review.images : review.images.slice(0, 3);

  return (
    <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        {/* Rating and Reviewer Info */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              {review.isVerifiedPurchase && (
                <Badge variant="success" className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Purchase
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900">{review.reviewerName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">
                {new Date(review.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Review Title */}
        {review.title && (
          <h4 className="text-base font-semibold text-slate-900">{review.title}</h4>
        )}

        {/* Review Content */}
        <p className="text-sm text-slate-700 leading-relaxed">{review.content}</p>

        {/* Pros and Cons */}
        {(review.pros || review.cons) && (
          <div className="grid gap-4 md:grid-cols-2">
            {review.pros && (
              <div className="rounded-lg bg-emerald-50 p-4">
                <h5 className="mb-2 text-xs font-semibold text-emerald-900">Pros</h5>
                <p className="text-sm text-emerald-800">{review.pros}</p>
              </div>
            )}
            {review.cons && (
              <div className="rounded-lg bg-red-50 p-4">
                <h5 className="mb-2 text-xs font-semibold text-red-900">Cons</h5>
                <p className="text-sm text-red-800">{review.cons}</p>
              </div>
            )}
          </div>
        )}

        {/* Review Images */}
        {review.images.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {displayImages.map((image, index) => (
                <div
                  key={index}
                  className="aspect-square overflow-hidden rounded-lg border border-slate-200"
                >
                  <img
                    src={image}
                    alt={`Review image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            {review.images.length > 3 && !showAllImages && (
              <button
                onClick={() => setShowAllImages(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                +{review.images.length - 3} more images
              </button>
            )}
          </div>
        )}

        {/* Admin Response */}
        {review.adminResponse && (
          <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                Seller Response
              </Badge>
              {review.adminRespondedAt && (
                <span className="text-xs text-slate-500">
                  {new Date(review.adminRespondedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700">{review.adminResponse}</p>
          </div>
        )}

        {/* Helpful Voting */}
        <div className="flex items-center gap-4 border-t border-slate-200 pt-4">
          <span className="text-sm text-slate-600">Was this helpful?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onVote(review.id, true)}
              disabled={hasVoted}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                hasVoted
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{review.helpfulCount}</span>
            </button>
            <button
              onClick={() => onVote(review.id, false)}
              disabled={hasVoted}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                hasVoted
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 hover:border-red-500 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              <span>{review.notHelpfulCount}</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
