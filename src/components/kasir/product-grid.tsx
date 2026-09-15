import type { MenuProduct } from "@/lib/menu/get-active-menu";
import { ProductButton } from "./product-button";

export function ProductGrid({
  products,
  cartQtyByProduct,
  onTapProduct,
}: {
  products: MenuProduct[];
  cartQtyByProduct: Record<string, number>;
  onTapProduct: (product: MenuProduct) => void;
}) {
  return (
    <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3">
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
