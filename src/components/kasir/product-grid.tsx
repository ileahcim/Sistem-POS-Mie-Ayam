import type { MenuProduct } from "@/lib/menu/get-active-menu";
import { cn } from "@/components/ui/cn";
import { ProductButton } from "./product-button";

export function ProductGrid({
  products,
  cartQtyByProduct,
  onTapProduct,
  className,
}: {
  products: MenuProduct[];
  cartQtyByProduct: Record<string, number>;
  onTapProduct: (product: MenuProduct) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2 lg:grid-cols-3",
        className,
      )}
    >
      {products.map((product) => (
        <ProductButton
          key={product.id}
          name={product.name}
          price={product.price}
          cartQty={cartQtyByProduct[product.id] ?? 0}
          onTap={() => onTapProduct(product)}
        />
      ))}
    </div>
  );
}
