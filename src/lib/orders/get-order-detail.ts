import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";

export type OrderDetailItem = {
  id: string;
  productName: string;
  unitPrice: number;
  addons: { name: string; price: number }[];
  notes: string | null;
  qty: number;
  lineTotal: number;
  isDeliveryChargeable: boolean;
};

export type OrderDetail = {
  id: string;
  queueNumber: number;
  orderNumber: number;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  status: "OPEN" | "PAID" | "VOID" | "RECEIVABLE";
  servedAt: string | null;
  createdAt: string;
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | null;
  paidAt: string | null;
  cashTendered: number | null;
  changeGiven: number | null;
  items: OrderDetailItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { addons: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) return null;

  const items: OrderDetailItem[] = order.items.map((item) => ({
    id: item.id,
    productName: item.productName,
    unitPrice: item.unitPrice,
    addons: item.addons.map((a) => ({ name: a.name, price: a.price })),
    notes: item.notes,
    qty: item.qty,
    lineTotal: item.lineTotal,
    isDeliveryChargeable: item.isDeliveryChargeable,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee =
    order.channel === "ANTAR"
      ? items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
      : 0;

  return {
    id: order.id,
    queueNumber: order.queueNumber,
    orderNumber: order.orderNumber,
    channel: order.channel,
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    status: order.status,
    servedAt: order.servedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt?.toISOString() ?? null,
    cashTendered: order.cashTendered,
    changeGiven: order.changeGiven,
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  };
}
