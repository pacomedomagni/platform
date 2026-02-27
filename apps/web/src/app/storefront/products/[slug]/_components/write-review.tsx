'use client';

import { useState } from 'react';
import { Button, Card, Input, Label, Textarea, Spinner } from '@platform/ui';
import { X, Star, AlertCircle } from 'lucide-react';
import { reviewsApi, CreateReviewDto } from '@/lib/reviews-api';
import { useAuthStore } from '@/lib/auth-store';

interface WriteReviewProps {
  productId: string;
  productSlug: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function WriteReview({ productId, productSlug, onClose, onSubmitted }: WriteReviewProps) {
  const { customer } = useAuthStore();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [reviewerName, setReviewerName] = useState(
    customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a review title');
      return;
    }
    if (!content.trim()) {
      setError('Please enter your review');
      return;
    }
    if (!reviewerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create review (H3: image upload removed until backend supports it)
      const reviewData: CreateReviewDto = {
        productListingId: productId,
        rating,
        title: title.trim(),
        content: content.trim(),
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
        reviewerName: reviewerName.trim(),
      };

      await reviewsApi.createReview(reviewData);

      onSubmitted();
    } catch (err) {
      console.error('Failed to submit review:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border-slate-200/70 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Write a Review</h2>
            <p className="mt-1 text-sm text-slate-500">
              Share your experience with this product
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star Rating */}
            <div className="space-y-2">
              <Label>Rating *</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 text-sm font-medium text-slate-700">
                    {rating === 1 && 'Poor'}
                    {rating === 2 && 'Fair'}
                    {rating === 3 && 'Good'}
                    {rating === 4 && 'Very Good'}
                    {rating === 5 && 'Excellent'}
                  </span>
                )}
              </div>
            </div>

            {/* Reviewer Name */}
            <div className="space-y-2">
              <Label htmlFor="reviewerName">Your Name *</Label>
              <Input
                id="reviewerName"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Enter your name"
                disabled={!!customer}
              />
              {customer && (
                <p className="text-xs text-slate-500">
                  This will be displayed with your review
                </p>
              )}
            </div>

            {/* Review Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Review Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience"
                maxLength={200}
              />
              <p className="text-xs text-slate-500">{title.length}/200 characters</p>
            </div>

            {/* Review Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Your Review *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tell us about your experience with this product..."
                rows={6}
                maxLength={5000}
              />
              <p className="text-xs text-slate-500">{content.length}/5000 characters</p>
            </div>

            {/* Pros (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="pros">Pros (Optional)</Label>
              <Textarea
                id="pros"
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                placeholder="What did you like about this product?"
                rows={3}
                maxLength={1000}
              />
            </div>

            {/* Cons (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="cons">Cons (Optional)</Label>
              <Textarea
                id="cons"
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                placeholder="What could be improved?"
                rows={3}
                maxLength={1000}
              />
            </div>

            {/* H3: Photo upload hidden - backend not yet implemented */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400 italic">
                Photo uploads are not yet supported. This feature is coming soon.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 border-t border-slate-200 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Your review will be published after moderation
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
