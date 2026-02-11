/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  CreateGiftCardDto,
  RedeemGiftCardDto,
  GiftCardTransactionDto,
} from './dto';

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ PUBLIC ENDPOINTS ============

  async checkBalance(tenantId: string, code: string, pin?: string) {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: { tenantId, code: code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    // Verify PIN if set (use timing-safe comparison to prevent timing attacks)
    if (giftCard.pin) {
      const pinStr = String(pin || '');
      const storedPin = String(giftCard.pin);
      if (pinStr.length !== storedPin.length || !crypto.timingSafeEqual(Buffer.from(pinStr), Buffer.from(storedPin))) {
        throw new BadRequestException('Invalid PIN');
      }
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
    amount: number
  ) {
    // Use interactive transaction with row-level locking to prevent race conditions
    return this.prisma.$transaction(async (tx) => {
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

      // Verify PIN if set (timing-safe comparison)
      if (giftCard.pin) {
        const pinStr = String(dto.pin || '');
        const storedPin = String(giftCard.pin);
        if (pinStr.length !== storedPin.length || !crypto.timingSafeEqual(Buffer.from(pinStr), Buffer.from(storedPin))) {
          throw new BadRequestException('Invalid PIN');
        }
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
    });
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
    // Generate unique code
    const code = this.generateGiftCardCode();

    const giftCard = await this.prisma.giftCard.create({
      data: {
        tenantId,
        code,
        pin: dto.sourceType === 'purchased' ? this.generatePin() : null,
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

    return giftCard;
  }

  async activateGiftCard(tenantId: string, id: string) {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: { id, tenantId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    if (giftCard.status !== 'pending') {
      throw new BadRequestException('Gift card is not pending activation');
    }

    const [transaction, updated] = await this.prisma.$transaction([
      this.prisma.giftCardTransaction.create({
        data: {
          tenantId,
          giftCardId: id,
          type: 'activation',
          amount: giftCard.initialValue,
          balanceBefore: 0,
          balanceAfter: giftCard.initialValue,
        },
      }),
      this.prisma.giftCard.update({
        where: { id },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      }),
    ]);

    return updated;
  }

  async adjustBalance(tenantId: string, id: string, dto: GiftCardTransactionDto, performedBy?: string) {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: { id, tenantId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    const newBalance = Number(giftCard.currentBalance) + dto.amount;
    if (newBalance < 0) {
      throw new BadRequestException('Resulting balance cannot be negative');
    }

    const [transaction, updated] = await this.prisma.$transaction([
      this.prisma.giftCardTransaction.create({
        data: {
          tenantId,
          giftCardId: id,
          type: dto.type,
          amount: dto.amount,
          balanceBefore: giftCard.currentBalance,
          balanceAfter: newBalance,
          orderId: dto.orderId,
          notes: dto.notes,
          performedBy,
        },
      }),
      this.prisma.giftCard.update({
        where: { id },
        data: {
          currentBalance: newBalance,
          status: newBalance <= 0 ? 'depleted' : 'active',
        },
      }),
    ]);

    return updated;
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
