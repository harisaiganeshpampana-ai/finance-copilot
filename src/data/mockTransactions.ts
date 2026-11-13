// Mock data only. Not connected to any bank.
// Amounts are in whole cents to avoid rounding errors:
// positive = money in, negative = money out.

export type Transaction = {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  merchant: string;
  amountCents: number;
};

export const mockTransactions: Transaction[] = [
  { id: "t1", date: "2026-11-12", merchant: "Green Basket Grocery", amountCents: -8423 },
  { id: "t2", date: "2026-11-11", merchant: "StreamBox Subscription", amountCents: -1549 },
  { id: "t3", date: "2026-11-10", merchant: "Corner Fuel Station", amountCents: -4710 },
  { id: "t4", date: "2026-11-08", merchant: "Acme Corp Payroll", amountCents: 325000 },
  { id: "t5", date: "2026-11-07", merchant: "Daily Grind Coffee", amountCents: -675 },
  { id: "t6", date: "2026-11-06", merchant: "Oakwood Apartments Rent", amountCents: -145000 },
  { id: "t7", date: "2026-11-05", merchant: "ShopNow Online", amountCents: -3299 },
  { id: "t8", date: "2026-11-04", merchant: "City Power & Light", amountCents: -11240 },
  { id: "t9", date: "2026-11-02", merchant: "QuickRide", amountCents: -1850 },
  { id: "t10", date: "2026-11-01", merchant: "Freelance Client Payment", amountCents: 60000 },
];
