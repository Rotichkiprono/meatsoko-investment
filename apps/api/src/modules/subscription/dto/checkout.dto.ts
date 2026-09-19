import { Type } from "class-transformer";
import { IsInt, Min, Max, IsNotEmpty } from "class-validator";

export class CheckoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "You must purchase at least 1 MEAT token." })
  @Max(100000, { message: "Maximum per-transaction limit exceeded." })
  @IsNotEmpty()
  tokenQuantity: number;
}
