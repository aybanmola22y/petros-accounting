export type MockPaymentMethod = {
  id: string;
  name: string;
  isCreditCard: boolean;
  isCustom: boolean;
};

export const SEED_PAYMENT_METHOD_NAMES = [
  "Bank Deposit",
  "Bank Transfer",
  "Bayad Center",
  "BDO",
  "BPI Bank Deposit",
  "BPI Bank Payment",
  "BPI Bank Transfer",
  "Ca",
  "Cash",
  "Cebuana Lhuilllier",
  "Check",
  "Cheque",
  "Credit Card",
  "Direct Debit",
  "GCash",
  "GOtyme",
  "Maya",
  "ML Kwarta Padala",
  "Palawan Express Pera Padala",
  "Paymaya",
  "Paypal",
  "Western Union",
] as const;

function seedId(name: string) {
  return `pm-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function buildSeedPaymentMethods(): MockPaymentMethod[] {
  return SEED_PAYMENT_METHOD_NAMES.map((name) => ({
    id: seedId(name),
    name,
    isCreditCard: /credit\s*card/i.test(name),
    isCustom: false,
  }));
}

export function paymentMethodNames(methods: MockPaymentMethod[]): string[] {
  return methods.map((m) => m.name);
}
