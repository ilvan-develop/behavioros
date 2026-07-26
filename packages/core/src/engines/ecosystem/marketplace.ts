import type { Registry } from './registry';

/**
 * Listing — Configuration and options interface.
 */
export interface Listing {
  packageId: string;
  featured: boolean;
  category: string;
  rating: number;
  reviewCount: number;
  installCount: number;
  verified: boolean;
  addedAt: string;
}

/**
 * Review — Configuration and options interface.
 */
export interface Review {
  id: string;
  packageId: string;
  userId: string;
  rating: number;
  title?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Marketplace — marketplace.
 *
 * Methods: addListing, listFeatured, listByCategory, install, uninstall, getInstalled, and 4 more.
 */
export class Marketplace {
  private registry: Registry;
  private listings = new Map<string, Listing>();
  private reviews: Review[] = [];
  private userInstallations = new Map<string, Set<string>>();
  private reviewCounter = 0;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  private nextReviewId(): string {
    this.reviewCounter++;
    return `rev-${this.reviewCounter}`;
  }

  private getOrCreateListing(packageId: string): Listing {
    const existing = this.listings.get(packageId);
    if (existing) return existing;
    const listing: Listing = {
      packageId,
      featured: false,
      category: 'uncategorized',
      rating: 0,
      reviewCount: 0,
      installCount: 0,
      verified: false,
      addedAt: new Date().toISOString(),
    };
    this.listings.set(packageId, listing);
    return listing;
  }

  addListing(
    packageId: string,
    category: string,
    options?: { featured?: boolean; verified?: boolean },
  ): Listing {
    const existing = this.listings.get(packageId);
    if (existing) {
      existing.category = category;
      if (options?.featured !== undefined) existing.featured = options.featured;
      if (options?.verified !== undefined) existing.verified = options.verified;
      return existing;
    }
    const listing: Listing = {
      packageId,
      featured: options?.featured ?? false,
      category,
      rating: 0,
      reviewCount: 0,
      installCount: 0,
      verified: options?.verified ?? false,
      addedAt: new Date().toISOString(),
    };
    this.listings.set(packageId, listing);
    return listing;
  }

  listFeatured(): Listing[] {
    return Array.from(this.listings.values()).filter((l) => l.featured);
  }

  listByCategory(category: string): Listing[] {
    return Array.from(this.listings.values()).filter((l) => l.category === category);
  }

  install(packageId: string, userId: string): boolean {
    const pkg = this.registry.get(packageId);
    if (!pkg) throw new Error(`Package ${packageId} not found in registry`);

    const listing = this.getOrCreateListing(packageId);

    if (!this.userInstallations.has(userId)) {
      this.userInstallations.set(userId, new Set());
    }
    const userSet = this.userInstallations.get(userId)!;
    if (userSet.has(packageId)) return false;

    userSet.add(packageId);
    listing.installCount++;
    return true;
  }

  uninstall(packageId: string, userId: string): boolean {
    const userSet = this.userInstallations.get(userId);
    if (!userSet?.has(packageId)) return false;

    userSet.delete(packageId);
    const listing = this.listings.get(packageId);
    if (listing && listing.installCount > 0) {
      listing.installCount--;
    }
    return true;
  }

  getInstalled(userId: string): string[] {
    return Array.from(this.userInstallations.get(userId) ?? []);
  }

  rate(
    packageId: string,
    userId: string,
    rating: number,
    title?: string,
    content?: string,
  ): Review {
    if (rating < 0 || rating > 5) throw new Error('Rating must be between 0 and 5');
    const pkg = this.registry.get(packageId);
    if (!pkg) throw new Error(`Package ${packageId} not found in registry`);

    const listing = this.getOrCreateListing(packageId);

    const review: Review = {
      id: this.nextReviewId(),
      packageId,
      userId,
      rating,
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.reviews.push(review);

    const pkgReviews = this.reviews.filter((r) => r.packageId === packageId);
    listing.reviewCount = pkgReviews.length;
    listing.rating = pkgReviews.reduce((sum, r) => sum + r.rating, 0) / pkgReviews.length;

    return review;
  }

  getReviews(packageId: string): Review[] {
    return this.reviews.filter((r) => r.packageId === packageId);
  }

  search(query: string, category?: string): Listing[] {
    const lower = query.toLowerCase();
    return Array.from(this.listings.values()).filter((listing) => {
      if (category && listing.category !== category) return false;
      const pkg = this.registry.get(listing.packageId);
      if (!pkg) return false;
      return (
        pkg.id.toLowerCase().includes(lower) ||
        pkg.name.toLowerCase().includes(lower) ||
        pkg.tags.some((t) => t.toLowerCase().includes(lower))
      );
    });
  }

  getAllCategories(): string[] {
    const cats = new Set<string>();
    for (const listing of this.listings.values()) {
      cats.add(listing.category);
    }
    return Array.from(cats).sort();
  }
}
