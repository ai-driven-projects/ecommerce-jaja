import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CartDetailDTO } from '@jaja/orders';
import { CartPrisma } from './cart.prisma.js';
import type { CartItemsBody } from './cart-http.js';
import { throwFailure, toGuestItems } from './cart-http.js';

// Public cart routes. There is no global guard, so these routes need no token,
// and an `Authorization` header (valid or not) is simply ignored.
@Controller('cart')
export class CartController {
  constructor(private readonly cartPrisma: CartPrisma) {}

  // Lines and totals of the guest cart kept in the browser. Only reads data and
  // never answers 400 because of the items: they are normalized first.
  @Post('preview')
  @HttpCode(200)
  async preview(@Body() body: CartItemsBody): Promise<CartDetailDTO> {
    const result = await this.cartPrisma.previewCart.execute(toGuestItems(body));

    if (result.isFailure) throwFailure(result.errors);
    return result.instance;
  }
}
