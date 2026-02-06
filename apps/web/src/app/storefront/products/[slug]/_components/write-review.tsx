'use client';

import { useState, useRef } from 'react';
import { Button, Card, Input, Label, Textarea, Spinner } from '@platform/ui';
import { X, Star, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
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
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (images.length + files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    // Validate file sizes (max 5MB per image)
    const invalidFiles = files.filter((file) => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setError('Each image must be less than 5MB');
      return;
    }

    // Create previews
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
    setImages([...images, ...files]);
    setError(null);
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setImages(images.filter((_, i) => i !== index));
  };

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
      // Upload images first if any
      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await reviewsApi.uploadImages(images);
      }

      // Create review
      const reviewData: CreateReviewDto = {
        productListingId: productId,
        rating,
        title: title.trim(),
        content: content.trim(),
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
        reviewerName: reviewerName.trim(),
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };

      await reviewsApi.createReview(reviewData);

      // Clean up previews
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));

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
                maxLength={100}
              />
              <p className="text-xs text-slate-500">{title.length}/100 characters</p>
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
                maxLength={1000}
              />
              <p className="text-xs text-slate-500">{content.length}/1000 characters</p>
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
                maxLength={500}
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
                maxLength={500}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photos (Optional)</Label>
              <p className="text-xs text-slate-500">Add up to 5 photos (max 5MB each)</p>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="h-full w-full rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < 5 && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photos ({images.length}/5)
                  </Button>
                </div>
              )}
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
