import { prisma } from "@/lib/prisma";
import { DELIVERY_FEE_PER_FOOD_ITEM } from "./pricing";
import { depositPosition, type DepositMethod } from "@/lib/deposits/settle";

export type OrderDetailItem = {
  id: string;
  productName: string;
  unitPrice: number;
  addons: { name: string; price: number }[];
  notes: string | null;
  qty: number;
  lineTotal: number;
  isDeliveryChargeable: boolean;
  // Read live off the product's category (OrderItem doesn't snapshot it) —
  // it only ever drives the on-screen reading order, see line-order.ts, so
  // following a later re-ordering of the categories is the right behaviour.
  categorySortOrder: number;
};

// One DP the customer paid on a pre-order (the RECEIVED entries of the ledger).
export type OrderDetailDeposit = {
  id: string;
  method: DepositMethod;
  amount: number;
  receivedAt: string; // ISO
  receivedByName: string;
};

// How a cancelled pre-order's DP ended: handed back, or kept ("DP hangus").
export type OrderDetailDepositOutcome = {
  kind: "REFUNDED" | "FORFEITED";
  method: DepositMethod;
  amount: number;
};

export type OrderDetail = {
  id: string;
  shiftId: string | null; // null until a shift is attached — see "Pre-order" in CLAUDE.md
  queueNumber: number | null; // null until shiftId is attached (same moment)
  queueSuffix: string; // "" normally, "A"/"B"/... for a Pisahkan & Bayar child — see queue-label.ts
  orderNumber: number;
  channel: "DINE_IN" | "BUNGKUS" | "ANTAR";
  tableLabel: string | null;
  customerName: string | null;
  createdByName: string; // who input the order — printed as "Kasir" on the receipt
  status: "OPEN" | "PAID" | "VOID" | "RECEIVABLE" | "CANCELLED";
  servedAt: string | null;
  createdAt: string;
  scheduledFor: string | null; // pre-order delivery date/time, null for a regular order
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | null;
  paidAt: string | null;
  cashTendered: number | null;
  changeGiven: number | null;
  voidReason: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
  // Status of the shift this order belongs to — a void after that shift
  // closed doesn't change its frozen report (shown as a notice).
  shiftStatus: "OPEN" | "CLOSED" | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  items: OrderDetailItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  // Pre-order DP. `deposits` is empty for every ordinary order — and then
  // depositTotal is 0, amountDue === total and refundDue is 0, so nothing
  // downstream needs a special case.
  deposits: OrderDetailDeposit[];
  depositTotal: number;
  // What still has to be collected at the till (total minus DP, never below 0).
  amountDue: number;
  // DP beyond the total — the order shrank after the DP was taken. Shown as
  // "Kembalikan Rp X", never silently treated as 0.
  refundDue: number;
  // Only for a CANCELLED order that held DP.
  depositOutcomes: OrderDetailDepositOutcome[];
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      // Still creation order: this list also feeds buildReceiptData, and the
      // printed struk deliberately keeps the order the items were added in.
      // Screens sort their own copy (sortOrderLines) instead.
      items: {
        include: { addons: true, product: { select: { category: { select: { sortOrder: true } } } } },
        orderBy: { createdAt: "asc" },
      },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
      shift: { select: { status: true } },
      deposits: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { createdBy: { select: { name: true } } },
      },
    },
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
    categorySortOrder: item.product.category.sortOrder,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee =
    order.channel === "ANTAR"
      ? items.reduce((sum, i) => sum + (i.isDeliveryChargeable ? i.qty : 0), 0) * DELIVERY_FEE_PER_FOOD_ITEM
      : 0;

  const total = subtotal + deliveryFee;
  const deposits: OrderDetailDeposit[] = order.deposits
    .filter((d) => d.kind === "RECEIVED")
    .map((d) => ({
      id: d.id,
      method: d.method as DepositMethod,
      amount: d.amount,
      receivedAt: d.createdAt.toISOString(),
      receivedByName: d.createdBy.name,
    }));
  const position = depositPosition(total, deposits.map((d) => d.amount));

  return {
    id: order.id,
    shiftId: order.shiftId,
    queueNumber: order.queueNumber,
    queueSuffix: order.queueSuffix,
    orderNumber: order.orderNumber,
    channel: order.channel,
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    createdByName: order.createdBy.name,
    status: order.status,
    servedAt: order.servedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt?.toISOString() ?? null,
    cashTendered: order.cashTendered,
    changeGiven: order.changeGiven,
    voidReason: order.voidReason,
    voidedAt: order.voidedAt?.toISOString() ?? null,
    voidedByName: order.voidedBy?.name ?? null,
    shiftStatus: order.shift?.status ?? null,
    cancelReason: order.cancelReason,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelledByName: order.cancelledBy?.name ?? null,
    items,
    subtotal,
    deliveryFee,
    total,
    deposits,
    depositTotal: position.held,
    amountDue: position.remainder,
    refundDue: position.excess,
    depositOutcomes:
      order.status === "CANCELLED"
        ? order.deposits
            .filter((d) => d.kind === "REFUNDED" || d.kind === "FORFEITED")
            .map((d) => ({ kind: d.kind as "REFUNDED" | "FORFEITED", method: d.method as DepositMethod, amount: d.amount }))
        : [],
  };
}
