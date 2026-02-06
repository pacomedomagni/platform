'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge, Spinner, Textarea, Input } from '@platform/ui';
import { Star, ShieldCheck, Check, X, MessageSquare, Search, Filter } from 'lucide-react';
import { adminReviewsApi, AdminReview } from '@/lib/reviews-api';

type ReviewStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  useEffect(() => {
    loadReviews();
  }, [currentPage, statusFilter]);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      const data = await adminReviewsApi.listReviews({
        page: currentPage,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setReviews(data.reviews);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModerate = async (reviewId: string, status: 'approved' | 'rejected') => {
    try {
      await adminReviewsApi.moderateReview(reviewId, { status });
      await loadReviews();
    } catch (error) {
      console.error('Failed to moderate review:', error);
    }
  };

  const handleBulkModerate = async (status: 'approved' | 'rejected') => {
    if (selectedReviews.size === 0) return;

    try {
      await adminReviewsApi.bulkModerate(Array.from(selectedReviews), status);
      setSelectedReviews(new Set());
      await loadReviews();
    } catch (error) {
      console.error('Failed to bulk moderate:', error);
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!adminResponse.trim()) return;

    try {
      await adminReviewsApi.addResponse(reviewId, adminResponse.trim());
      setRespondingTo(null);
      setAdminResponse('');
      await loadReviews();
    } catch (error) {
      console.error('Failed to add response:', error);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      await adminReviewsApi.deleteReview(reviewId);
      await loadReviews();
    } catch (error) {
      console.error('Failed to delete review:', error);
    }
  };

  const toggleReviewSelection = (reviewId: string) => {
    const newSelection = new Set(selectedReviews);
    if (newSelection.has(reviewId)) {
      newSelection.delete(reviewId);
    } else {
      newSelection.add(reviewId);
    }
    setSelectedReviews(newSelection);
  };

  const selectAll = () => {
    if (selectedReviews.size === reviews.length) {
      setSelectedReviews(new Set());
    } else {
      setSelectedReviews(new Set(reviews.map((r) => r.id)));
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      review.title.toLowerCase().includes(search) ||
      review.content.toLowerCase().includes(search) ||
      review.productListing.displayName.toLowerCase().includes(search) ||
      review.reviewerName.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Product Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Moderate customer reviews and respond to feedback
        </p>
      </div>

      {/* Filters and Actions */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as ReviewStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Search and Bulk Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews..."
                className="pl-10"
              />
            </div>

            {selectedReviews.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  {selectedReviews.size} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkModerate('approved')}
                  className="text-emerald-600 hover:bg-emerald-50"
                >
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkModerate('rejected')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Reviews Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-500">No reviews found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedReviews.size === reviews.length && reviews.length > 0}
              onChange={selectAll}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Select all</span>
          </div>

          {/* Reviews List */}
          {filteredReviews.map((review) => (
            <Card key={review.id} className="border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                {/* Header with checkbox and status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedReviews.has(review.id)}
                      onChange={() => toggleReviewSelection(review.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div className="flex-1 space-y-2">
                      {/* Product and Rating */}
                      <div className="flex items-center gap-3">
                        <a
                          href={`/storefront/products/${review.productListing.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {review.productListing.displayName}
                        </a>
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
                            Verified
                          </Badge>
                        )}
                      </div>

                      {/* Reviewer Info */}
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">
                          {review.reviewerName}
                        </span>
                        {review.customer && (
                          <>
                            <span>·</span>
                            <span>{review.customer.email}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {new Date(review.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Review Title and Content */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-slate-900">{review.title}</h3>
                        <p className="text-sm text-slate-700">{review.content}</p>
                      </div>

                      {/* Pros and Cons */}
                      {(review.pros || review.cons) && (
                        <div className="grid gap-2 md:grid-cols-2">
                          {review.pros && (
                            <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                              <span className="font-semibold text-emerald-900">Pros:</span>{' '}
                              {review.pros}
                            </div>
                          )}
                          {review.cons && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm">
                              <span className="font-semibold text-red-900">Cons:</span>{' '}
                              {review.cons}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review Images */}
                      {review.images.length > 0 && (
                        <div className="flex gap-2">
                          {review.images.slice(0, 4).map((image, index) => (
                            <div
                              key={index}
                              className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200"
                            >
                              <img
                                src={image}
                                alt={`Review ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                          {review.images.length > 4 && (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
                              +{review.images.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Response */}
                      {review.adminResponse && (
                        <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3">
                          <div className="mb-1 text-xs font-semibold text-blue-900">
                            Your Response
                          </div>
                          <p className="text-sm text-blue-800">{review.adminResponse}</p>
                        </div>
                      )}

                      {/* Response Form */}
                      {respondingTo === review.id && (
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Textarea
                            value={adminResponse}
                            onChange={(e) => setAdminResponse(e.target.value)}
                            placeholder="Write your response..."
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSubmitResponse(review.id)}
                              disabled={!adminResponse.trim()}
                            >
                              Submit Response
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRespondingTo(null);
                                setAdminResponse('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>{getStatusBadge(review.status)}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
                  {review.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModerate(review.id, 'approved')}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModerate(review.id, 'rejected')}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {!review.adminResponse && review.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRespondingTo(review.id)}
                    >
                      <MessageSquare className="mr-1 h-4 w-4" />
                      Respond
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(review.id)}
                    className="ml-auto text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
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
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
