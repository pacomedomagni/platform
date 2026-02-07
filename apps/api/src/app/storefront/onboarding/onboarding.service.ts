import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma, StoreCustomer } from '@prisma/client';

export interface OnboardingStatus {
  completed: boolean;
  currentStep: string | null;
  profileCompletionScore: number;
  checklist: {
    emailVerified: boolean;
    profileCompleted: boolean;
    addedToCart: boolean;
    completedFirstPurchase: boolean;
    addedShippingAddress: boolean;
  };
  hasViewedProductTour: boolean;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get onboarding status for a customer
   */
  async getOnboardingStatus(
    tenantId: string,
    customerId: string
  ): Promise<OnboardingStatus> {
    const customer = await this.prisma.storeCustomer.findUnique({
      where: {
        id: customerId,
        tenantId,
      },
      include: {
        addresses: {
          take: 1,
        },
        orders: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
        carts: {
          where: {
            status: 'active',
          },
          include: {
            items: {
              take: 1,
            },
          },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate profile completion score
    const profileScore = this.calculateProfileScore(customer);

    return {
      completed: customer.onboardingCompleted,
      currentStep: customer.onboardingStep,
      profileCompletionScore: profileScore,
      checklist: {
        emailVerified: customer.emailVerified,
        profileCompleted: profileScore === 100,
        addedToCart: customer.hasAddedToCart || (customer.carts[0]?.items.length ?? 0) > 0,
        completedFirstPurchase: customer.hasCompletedFirstPurchase || customer.orders.length > 0,
        addedShippingAddress: customer.hasAddedShippingAddress || customer.addresses.length > 0,
      },
      hasViewedProductTour: customer.hasViewedProductTour,
    };
  }

  /**
   * Update onboarding step
   */
  async updateOnboardingStep(
    tenantId: string,
    customerId: string,
    step: string
  ): Promise<void> {
    await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: {
        onboardingStep: step,
        lastOnboardingInteraction: new Date(),
      },
    });
  }

  /**
   * Complete a specific onboarding step
   */
  async completeStep(
    tenantId: string,
    customerId: string,
    step: string
  ): Promise<OnboardingStatus> {
    const customer = await this.prisma.storeCustomer.findUnique({
      where: {
        id: customerId,
        tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updateData: Prisma.StoreCustomerUpdateInput = {
      lastOnboardingInteraction: new Date(),
    };

    // Update specific flags based on step
    switch (step) {
      case 'profile':
        updateData.profileCompletionScore = this.calculateProfileScore(customer);
        break;
      case 'tour':
        updateData.hasViewedProductTour = true;
        break;
      case 'cart':
        updateData.hasAddedToCart = true;
        break;
      case 'purchase':
        updateData.hasCompletedFirstPurchase = true;
        break;
      case 'address':
        updateData.hasAddedShippingAddress = true;
        break;
    }

    await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: updateData,
    });

    return this.getOnboardingStatus(tenantId, customerId);
  }

  /**
   * Mark onboarding as completed and dismiss
   */
  async dismissOnboarding(
    tenantId: string,
    customerId: string
  ): Promise<void> {
    await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: {
        onboardingCompleted: true,
        onboardingStep: 'completed',
        lastOnboardingInteraction: new Date(),
      },
    });
  }

  /**
   * Get onboarding progress percentage
   */
  async getProgress(tenantId: string, customerId: string): Promise<number> {
    const status = await this.getOnboardingStatus(tenantId, customerId);

    const checklist = status.checklist;
    const completed = [
      checklist.emailVerified,
      checklist.profileCompleted,
      checklist.addedToCart,
      checklist.completedFirstPurchase,
      checklist.addedShippingAddress,
    ].filter(Boolean).length;

    return Math.round((completed / 5) * 100);
  }

  /**
   * Update profile and recalculate score
   */
  async updateProfile(
    tenantId: string,
    customerId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<OnboardingStatus> {
    const customer = await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: {
        ...data,
        profileCompletionScore: undefined, // Will be recalculated
      },
    });

    const profileScore = this.calculateProfileScore(customer);

    await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: {
        profileCompletionScore: profileScore,
      },
    });

    return this.getOnboardingStatus(tenantId, customerId);
  }

  /**
   * Calculate profile completion score (0-100)
   */
  private calculateProfileScore(customer: StoreCustomer): number {
    let score = 0;
    const fields = [
      customer.email,
      customer.firstName,
      customer.lastName,
      customer.phone,
      customer.emailVerified,
    ];

    const filledFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
    score = Math.round((filledFields / fields.length) * 100);

    return score;
  }

  /**
   * Reset product tour viewed status (for "show tour again")
   */
  async resetProductTour(
    tenantId: string,
    customerId: string
  ): Promise<void> {
    await this.prisma.storeCustomer.update({
      where: {
        id: customerId,
        tenantId,
      },
      data: {
        hasViewedProductTour: false,
      },
    });
  }
}
