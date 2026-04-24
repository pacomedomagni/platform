import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  CreateGiftCardDto,
  RedeemGiftCardDto,
  GiftCardTransactionDto,
} from './dto';

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phase 1 W1.4/W1.7: gift card PINs are bcrypt-hashed at rest.
   * Legacy plaintext PINs (pre-migration) are detected by the absence of a
   * bcrypt prefix and fall back to constant-time string compare so existing
   * cards keep working. New cards always store a bcrypt hash.
   */
  private static readonly PIN_BCRYPT_ROUNDS = 10;

  private async hashPin(plaintextPin: string): Promise<string> {
    return bcrypt.hash(plaintextPin, GiftCardsService.PIN_BCRYPT_ROUNDS);
  }

  private async comparePin(plaintextPin: string, storedValue: string): Promise<boolean> {
    const isBcrypt = /^\$2[aby]\$/.test(storedValue);
    if (isBcrypt) {
      return bcrypt.compare(plaintextPin, storedValue);
    }
    // Legacy plaintext — constant-time string compare. Still safe against
    // timing side channels; the audit finding is "stored in plaintext", which
    // will be remediated as cards are rotated / created.
    if (plaintextPin.length !== storedValue.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(plaintextPin),
      Buffer.from(storedValue),
    );
  }

  // ============ PUBLIC ENDPOINTS ============

  async checkBalance(tenantId: string, code: string, pin?: string, txClient?: any) {
    const db = txClient || this.prisma;
    const giftCard = await db.giftCard.findFirst({
      where: { tenantId, code: code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    // Verify PIN if set (bcrypt-aware; see comparePin)
    if (giftCard.pin) {
      const ok = await this.comparePin(String(pin || ''), String(giftCard.pin));
      if (!ok) throw new BadRequestException('Invalid PIN');
    }

    // Check if expired
    if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
      throw new BadRequestException('Gift card has expired');
    }

    // Check if disabled
    if (giftCard.status === 'disabled') {
      throw new BadRequestException('Gift card has been disabled');
    }

    return {
      code: giftCard.code,
      balance: giftCard.currentBalance,
      currency: giftCard.currency,
      expiresAt: giftCard.expiresAt,
      status: giftCard.status,
    };
  }

  async redeemForOrder(
    tenantId: string,
    orderId: string,
    dto: RedeemGiftCardDto,
    amount: number,
    txClient?: any,
  ) {
    const redeemLogic = async (tx: any) => {
      // Lock the gift card row to prevent concurrent redemptions
      const lockedCards = await tx.$queryRaw<any[]>`
        SELECT * FROM gift_cards
        WHERE "tenantId" = ${tenantId} AND code = ${dto.code.toUpperCase()}
        FOR UPDATE
      `;

      if (!lockedCards || lockedCards.length === 0) {
        throw new NotFoundException('Gift card not found');
      }

      const giftCard = lockedCards[0];

      // Verify PIN if set (bcrypt-aware; see comparePin)
      if (giftCard.pin) {
        const ok = await this.comparePin(String(dto.pin || ''), String(giftCard.pin));
        if (!ok) throw new BadRequestException('Invalid PIN');
      }

      // Validate card status
      if (giftCard.status !== 'active') {
        throw new BadRequestException(`Gift card is ${giftCard.status}`);
      }

      if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
        throw new BadRequestException('Gift card has expired');
      }

      // Calculate redemption amount
      const currentBalance = Number(giftCard.currentBalance);
      const redeemAmount = Math.min(currentBalance, amount);
      if (redeemAmount <= 0) {
        throw new BadRequestException('Gift card has no balance');
      }

      const newBalance = currentBalance - redeemAmount;

      // Create transaction record
      const transaction = await tx.giftCardTransaction.create({
        data: {
          tenantId,
          giftCardId: giftCard.id,
          type: 'redemption',
          amount: -redeemAmount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          orderId,
        },
      });

      // Update gift card balance
      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          currentBalance: newBalance,
          status: newBalance <= 0 ? 'depleted' : 'active',
        },
      });

      return {
        amountRedeemed: redeemAmount,
        remainingBalance: newBalance,
        transactionId: transaction.id,
      };
    };

    // If a transaction client is provided (e.g. from checkout), use it directly
    // to avoid nested transactions that can't see uncommitted rows (FK violation).
    // Otherwise, create a new transaction for standalone usage.
    if (txClient) {
      return redeemLogic(txClient);
    }
    return this.prisma.$transaction(redeemLogic);
  }

  // ============ ADMIN ENDPOINTS ============

  async listGiftCards(
    tenantId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.GiftCardWhereInput = { tenantId };
    if (status) where.status = status;

    const [giftCards, total] = await Promise.all([
      this.prisma.giftCard.findMany({
        where,
        include: {
          sourceOrder: {
            select: { id: true, orderNumber: true },
          },
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.giftCard.count({ where }),
    ]);

    return {
      giftCards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGiftCard(tenantId: string, id: string) {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: { id, tenantId },
      include: {
        sourceOrder: {
          select: { id: true, orderNumber: true },
        },
        transactions: {
          include: {
            order: {
              select: { id: true, orderNumber: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    return giftCard;
  }

  async createGiftCard(tenantId: string, dto: CreateGiftCardDto, createdBy?: string) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Generate unique code (retry with new code on conflict)
        const code = this.generateGiftCardCode();

        // Phase 1 W1.4: PIN is bcrypt-hashed at rest. The plaintext PIN is
        // returned to the caller exactly once (in the service return value)
        // so the merchant can deliver it to the recipient; nothing else has
        // access to it.
        const plaintextPin =
          dto.sourceType === 'purchased' ? this.generatePin() : null;
        const hashedPin = plaintextPin ? await this.hashPin(plaintextPin) : null;

        const giftCard = await this.prisma.giftCard.create({
          data: {
            tenantId,
            code,
            pin: hashedPin,
            initialValue: dto.initialValue,
            currentBalance: dto.initialValue,
            currency: dto.currency || 'USD',
            sourceType: dto.sourceType,
            sourceOrderId: dto.sourceOrderId,
            recipientEmail: dto.recipientEmail,
            recipientName: dto.recipientName,
            senderName: dto.senderName,
            personalMessage: dto.personalMessage,
            deliveryMethod: dto.deliveryMethod || 'email',
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            status: dto.sourceType === 'purchased' ? 'pending' : 'active',
            activatedAt: dto.sourceType === 'purchased' ? null : new Date(),
          },
        });

        // Create initial activation transaction for non-purchased cards
        if (dto.sourceType !== 'purchased') {
          await this.prisma.giftCardTransaction.create({
            data: {
              tenantId,
              giftCardId: giftCard.id,
              type: 'activation',
              amount: dto.initialValue,
              balanceBefore: 0,
              balanceAfter: dto.initialValue,
              notes: `Created as ${dto.sourceType} by ${createdBy || 'system'}`,
              performedBy: createdBy,
            },
          });
        }

        // Return the plaintext PIN once so the merchant/email handler can
        // deliver it; it is never readable after this call returns.
        return { ...giftCard, pin: plaintextPin };
      } catch (error) {
        // Retry on unique constraint violation (code collision)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < MAX_RETRIES - 1
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Failed to generate a unique gift card code. Please try again.');
  }

  async activateGiftCard(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the gift card row to prevent concurrent activations
      const lockedCards = await tx.$queryRaw<any[]>`
        SELECT * FROM gift_cards
        WHERE id = ${id} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (!lockedCards || lockedCards.length === 0) {
        throw new NotFoundException('Gift card not found');
      }

      const giftCard = lockedCards[0];

      if (giftCard.status !== 'pending') {
        throw new BadRequestException('Gift card is not pending activation');
      }

      await tx.giftCardTransaction.create({
        data: {
          tenantId,
          giftCardId: id,
          type: 'activation',
          amount: giftCard.initialValue,
          balanceBefore: 0,
          balanceAfter: giftCard.initialValue,
        },
      });

      return tx.giftCard.update({
        where: { id },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      });
    });
  }

  async adjustBalance(tenantId: string, id: string, dto: GiftCardTransactionDto, performedBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the gift card row to prevent concurrent balance modifications
      const lockedCards = await tx.$queryRaw<any[]>`
        SELECT * FROM gift_cards
        WHERE id = ${id} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (!lockedCards || lockedCards.length === 0) {
        throw new NotFoundException('Gift card not found');
      }

      const giftCard = lockedCards[0];

      // Negate the amount for deduction/redemption types
      const effectiveAmount = (dto.type === 'redemption' || dto.type === 'deduction')
        ? -Math.abs(dto.amount)
        : dto.amount;

      const currentBalance = Number(giftCard.currentBalance);
      const newBalance = currentBalance + effectiveAmount;
      if (newBalance < 0) {
        throw new BadRequestException('Resulting balance cannot be negative');
      }

      // Prevent balance from exceeding 2x the initial value to avoid abuse
      const maxBalance = Number(giftCard.initialValue) * 2;
      if (newBalance > maxBalance) {
        throw new BadRequestException(`Balance cannot exceed ${maxBalance.toFixed(2)}`);
      }

      await tx.giftCardTransaction.create({
        data: {
          tenantId,
          giftCardId: id,
          type: dto.type,
          amount: effectiveAmount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          orderId: dto.orderId,
          notes: dto.notes,
          performedBy,
        },
      });

      return tx.giftCard.update({
        where: { id },
        data: {
          currentBalance: newBalance,
          status: newBalance <= 0 ? 'depleted' : 'active',
        },
      });
    });
  }

  async disableGiftCard(tenantId: string, id: string) {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: { id, tenantId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    return this.prisma.giftCard.update({
      where: { id },
      data: { status: 'disabled' },
    });
  }

  // ============ HELPERS ============

  private generateGiftCardCode(): string {
    // Format: XXXX-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded: I, O, 0, 1 (avoid confusion)
    let code = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(crypto.randomInt(chars.length));
    }
    return code;
  }

  private generatePin(): string {
    return crypto.randomInt(1000, 10000).toString();
  }
}
