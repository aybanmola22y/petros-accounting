export type SupplierAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  addedAt: string;
};

export type SupplierProfile = {
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  cc?: string;
  bcc?: string;
  mobile?: string;
  fax?: string;
  other?: string;
  website?: string;
  street1?: string;
  street2?: string;
  street3?: string;
  street4?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  notes?: string;
  businessId?: string;
  billingRate?: string;
  paymentTerms?: string;
  accountNo?: string;
  defaultExpenseCategory?: string;
  openingBalanceAsOf?: string;
  attachments?: SupplierAttachment[];
};

export function formatSupplierAddress(profile?: SupplierProfile): string {
  if (!profile) return "";
  const lines = [
    profile.street1,
    profile.street2,
    profile.street3,
    profile.street4,
    [profile.city, profile.province].filter(Boolean).join(", "),
    [profile.zip, profile.country].filter(Boolean).join(" "),
  ].filter((l) => l?.trim());
  return lines.join("\n");
}

export type MockSupplier = {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  currency: string;
  openBalance: number;
  isCustom: boolean;
  profile?: SupplierProfile;
};

export const SEED_SUPPLIERS: Omit<MockSupplier, "isCustom">[] = [
  {
    id: "sup-1",
    name: "118 Poultry & Agricultural Trading",
    companyName: "118 Poultry & Agricultural Trading",
    phone: "",
    email: "",
    currency: "PHP",
    openBalance: 0,
  },
  {
    id: "sup-2",
    name: "138 foods Inc.",
    companyName: "138 foods Inc.",
    phone: "",
    email: "",
    currency: "PHP",
    openBalance: 0,
  },
  {
    id: "sup-3",
    name: "2GO Express",
    companyName: "2GO Express Inc.",
    phone: "+63 2 8772 0000",
    email: "billing@2go.com.ph",
    currency: "PHP",
    openBalance: 0,
  },
  {
    id: "sup-4",
    name: "ABC Logistics Corp.",
    companyName: "ABC Logistics Corporation",
    phone: "+63 917 555 0101",
    email: "ap@abclogistics.ph",
    currency: "PHP",
    openBalance: 45_200,
  },
  {
    id: "sup-5",
    name: "Cebu Office Supplies",
    companyName: "Cebu Office Supplies Trading",
    phone: "+63 32 234 5678",
    email: "",
    currency: "PHP",
    openBalance: 12_890.5,
  },
  {
    id: "sup-6",
    name: "Globe Business",
    companyName: "Globe Telecom Inc.",
    phone: "",
    email: "enterprise@globe.com.ph",
    currency: "PHP",
    openBalance: 64_684.5,
  },
  {
    id: "sup-7",
    name: "Manila Water Co.",
    companyName: "Manila Water Company Inc.",
    phone: "+63 2 1627",
    email: "",
    currency: "PHP",
    openBalance: 8_450,
  },
  {
    id: "sup-8",
    name: "Petron Dealers — Roxas",
    companyName: "Petron Roxas Station",
    phone: "",
    email: "",
    currency: "PHP",
    openBalance: 0,
  },
  {
    id: "sup-9",
    name: "Prime Packaging Solutions",
    companyName: "Prime Packaging Solutions Inc.",
    phone: "+63 918 222 3344",
    email: "accounts@primepack.ph",
    currency: "PHP",
    openBalance: 156_780,
  },
  {
    id: "sup-10",
    name: "TechServe IT Solutions",
    companyName: "TechServe IT Solutions OPC",
    phone: "",
    email: "billing@techserve.ph",
    currency: "PHP",
    openBalance: 0,
  },
];

export function buildSeedSuppliers(): MockSupplier[] {
  return SEED_SUPPLIERS.map((s) => ({ ...s, isCustom: false }));
}
