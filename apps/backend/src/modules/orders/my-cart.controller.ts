import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AddCartItem,
  CartDetailDTO,
  ClearCart,
  MergeCart,
  RemoveCartItem,
  SetCartItemQuantity,
} from '@jaja/orders';
import { Result } from '@mentoria-360/shared';
import { JwtGuard } from '../../shared/auth/jwt.guard.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import { CartPrisma } from './cart.prisma.js';
import type {
  AddCartItemBody,
  CartItemsBody,
  SetCartItemQuantityBody,
} from './cart-http.js';
import { throwFailure, toGuestItems } from './cart-http.js';

// The cart of the authenticated user, administrator or not. The owner is always
// the token user: no user or cart id is read from the body or the URL. Each
// command runs its use case and, on success, answers with the cart read by
// `findCartByUserId`, so every response has the same shape.
@Controller('me/cart')
@UseGuards(JwtGuard)
export class MyCartController {
  constructor(private readonly cartPrisma: CartPrisma) {}

  // Without a cart yet, the empty cart.
  @Get()
  async find(@CurrentUser('id') userId: string): Promise<CartDetailDTO> {
    return this.respondWith(userId);
  }

  // Sums the quantity (the "Adicionar" of the product page).
  @Post('items')
  @HttpCode(200)
  async add(
    @CurrentUser('id') userId: string,
    @Body() body: AddCartItemBody,
  ): Promise<CartDetailDTO> {
    const useCase = new AddCartItem(this.cartPrisma, this.cartPrisma.findAvailableProductIds);

    const result = await useCase.execute({
      userId,
      productId: body?.productId,
      quantity: body?.quantity === undefined ? 1 : body.quantity,
    });

    return this.respondAfter(result, userId);
  }

  // Sets the quantity (the steppers); a product not in the cart enters at the end.
  @Put('items/:productId')
  @HttpCode(200)
  async setQuantity(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() body: SetCartItemQuantityBody,
  ): Promise<CartDetailDTO> {
    const useCase = new SetCartItemQuantity(
      this.cartPrisma,
      this.cartPrisma.findAvailableProductIds,
    );

    const result = await useCase.execute({ userId, productId, quantity: body?.quantity });

    return this.respondAfter(result, userId);
  }

  // Idempotent: a product that is not in the cart answers the same cart.
  @Delete('items/:productId')
  @HttpCode(200)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ): Promise<CartDetailDTO> {
    const useCase = new RemoveCartItem(this.cartPrisma);

    const result = await useCase.execute({ userId, productId });

    return this.respondAfter(result, userId);
  }

  // Idempotent: an empty cart (or no cart) answers the empty cart.
  @Delete()
  @HttpCode(200)
  async clear(@CurrentUser('id') userId: string): Promise<CartDetailDTO> {
    const useCase = new ClearCart(this.cartPrisma);

    const result = await useCase.execute({ userId });

    return this.respondAfter(result, userId);
  }

  // Merges the guest cart on sign in; malformed items are dropped, never a 400.
  @Post('merge')
  @HttpCode(200)
  async merge(
    @CurrentUser('id') userId: string,
    @Body() body: CartItemsBody,
  ): Promise<CartDetailDTO> {
    const useCase = new MergeCart(this.cartPrisma, this.cartPrisma.findAvailableProductIds);

    const result = await useCase.execute({ userId, items: toGuestItems(body) });

    return this.respondAfter(result, userId);
  }

  private async respondAfter(result: Result<void>, userId: string): Promise<CartDetailDTO> {
    if (result.isFailure) throwFailure(result.errors);
    return this.respondWith(userId);
  }

  private async respondWith(userId: string): Promise<CartDetailDTO> {
    const result = await this.cartPrisma.findCartByUserId.execute(userId);

    if (result.isFailure) throwFailure(result.errors);
    return result.instance;
  }
}
