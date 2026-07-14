import type { InvoiceStatusTimeline, MockCustomer, MockInvoice, MockLead } from "./types";

function parseSeedDate(date: string): Date {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return new Date(2026, 4, 1, 10, 0, 0);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, Number(m[1]) - 1, Number(m[2]), 10, 0, 0);
}

/** Paid invoice timeline — deposited=false means payment is in undeposited funds. */
function paidInvoiceTimeline(date: string, deposited: boolean): InvoiceStatusTimeline {
  const opened = parseSeedDate(date);
  const paid = parseSeedDate(date);
  paid.setHours(14, 0, 0, 0);
  const paidAt = paid.toISOString();
  return {
    openedAt: opened.toISOString(),
    paidAt,
    ...(deposited ? { depositedAt: paidAt } : {}),
  };
}

/** Canonical customer records — open balances are computed from invoices. */
export const SEED_CUSTOMERS: MockCustomer[] = [
  {
    id: "c-elaika",
    name: "Elaika Joy Umali",
    companyName: "PSU BSN Studet",
    phone: "",
    email: "relaikajoy@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-aaron",
    name: "Aaron Cayle B. Nasareth",
    companyName: "None",
    phone: "",
    email: "aaron.nasareth@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-apple",
    name: "Apple Revillas",
    companyName: "None",
    phone: "+63 917 555 0202",
    email: "apple.revillas@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-aprlyn",
    name: "Ms. Aprlyn Pinca",
    companyName: "None",
    phone: "",
    email: "aprlyn.pinca@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-hartwell",
    name: "Mr. Hartwell C. Capistrano",
    companyName: "Capistrano Trading",
    phone: "+63 2 8123 4567",
    email: "hartwell.capistrano@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-michelle",
    name: "Michelle J. Dumaran",
    companyName: "None",
    phone: "",
    email: "michelle.dumaran@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-nguyen",
    name: "Nguyen P. Dang",
    companyName: "Dang Enterprises",
    phone: "",
    email: "nguyen.dang@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-elvy",
    name: "Elvy B. Batalla",
    companyName: "None",
    phone: "+63 917 555 0100",
    email: "elvy.batalla@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-prime",
    name: "Prime Packaging Solutions",
    companyName: "Prime Packaging Solutions Inc.",
    phone: "+63 32 345 6789",
    email: "accounts@primepack.ph",
    currency: "PHP",
  },
  {
    id: "c-rorobus",
    name: "Rorobus transport services Inc.",
    companyName: "Rorobus transport services Inc.",
    phone: "",
    email: "billing@rorobus.ph",
    currency: "PHP",
  },
  {
    id: "c-juan",
    name: "Juan Dela Cruz",
    companyName: "None",
    phone: "+63 917 123 4567",
    email: "juan.delacruz@gmail.com",
    currency: "PHP",
  },
  {
    id: "c-abc",
    name: "ABC Logistics Corp.",
    companyName: "ABC Logistics Corporation",
    phone: "+63 917 555 0101",
    email: "ap@abclogistics.ph",
    currency: "PHP",
  },
  {
    id: "c-cebu",
    name: "Cebu Office Supplies",
    companyName: "Cebu Office Supplies Trading",
    phone: "+63 32 234 5678",
    email: "sales@cebuoffice.ph",
    currency: "PHP",
  },
  {
    id: "c-globe",
    name: "Globe Business",
    companyName: "Globe Telecom Inc.",
    phone: "",
    email: "enterprise@globe.com.ph",
    currency: "PHP",
  },
  {
    id: "c-manila",
    name: "Manila Water Co.",
    companyName: "Manila Water Company",
    phone: "",
    email: "billing@manilawater.com.ph",
    currency: "PHP",
  },
];

export const SEED_LEADS: MockLead[] = [
  { id: "l1", name: "Maria Santos", companyName: "Santos Retail", phone: "+63 917 111 2222", source: "Website" },
  { id: "l2", name: "Roberto Lim", companyName: "None", phone: "", source: "Referral" },
];

/** 18 overdue + 2 open = 20 unpaid (₱74,094 overdue + ₱24,500 not due = ₱98,594). */
export const SEED_UNPAID_INVOICES: MockInvoice[] = [
  { id: "inv-001", date: "5/01/26", number: "06085", customerId: "c-rorobus", amount: 54_144, balanceDue: 54_144, kind: "overdue", overdueDays: 20 },
  {
    id: "inv-002",
    date: "5/18/26",
    number: "06128",
    customerId: "c-apple",
    amount: 12_750,
    balanceDue: 12_750,
    kind: "overdue",
    overdueDays: 3,
    statusSub: "Viewed",
    statusTimeline: {
      openedAt: "2026-05-18T10:00:00.000Z",
      sentAt: "2026-05-18T10:55:00.000Z",
      viewedAt: "2026-06-10T10:29:00.000Z",
      viewCount: 3,
      viewHistory: [
        "2026-06-10T10:29:00.000Z",
        "2026-06-10T09:15:00.000Z",
        "2026-06-09T16:42:00.000Z",
      ],
    },
  },
  { id: "inv-003", date: "5/10/26", number: "06110", customerId: "c-nguyen", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 11 },
  { id: "inv-004", date: "5/08/26", number: "06105", customerId: "c-elvy", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 13 },
  { id: "inv-005", date: "5/16/26", number: "06122", customerId: "c-hartwell", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 5 },
  { id: "inv-006", date: "5/15/26", number: "06118", customerId: "c-michelle", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 6 },
  { id: "inv-007", date: "5/14/26", number: "06115", customerId: "c-elaika", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 7 },
  { id: "inv-008", date: "5/13/26", number: "06112", customerId: "c-abc", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 8 },
  { id: "inv-009", date: "5/12/26", number: "06111", customerId: "c-prime", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 8 },
  { id: "inv-010", date: "5/11/26", number: "06109", customerId: "c-globe", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 9 },
  { id: "inv-011", date: "5/10/26", number: "06108", customerId: "c-manila", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 10 },
  { id: "inv-012", date: "5/09/26", number: "06107", customerId: "c-aprlyn", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 10 },
  { id: "inv-013", date: "5/08/26", number: "06106", customerId: "c-juan", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 11 },
  { id: "inv-014", date: "5/07/26", number: "06104", customerId: "c-cebu", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 12 },
  { id: "inv-015", date: "5/06/26", number: "06103", customerId: "c-aaron", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 12 },
  { id: "inv-016", date: "5/05/26", number: "06102", customerId: "c-elaika", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 13 },
  { id: "inv-017", date: "5/04/26", number: "06101", customerId: "c-abc", amount: 444, balanceDue: 444, kind: "overdue", overdueDays: 14 },
  { id: "inv-018", date: "5/03/26", number: "06099", customerId: "c-prime", amount: 540, balanceDue: 540, kind: "overdue", overdueDays: 15 },
  { id: "inv-019", date: "5/12/26", number: "06110b", customerId: "c-cebu", amount: 12_250, balanceDue: 12_250, kind: "open" },
  { id: "inv-020", date: "5/05/26", number: "06095", customerId: "c-manila", amount: 12_250, balanceDue: 12_250, kind: "open" },
];

/** 24 recently paid invoices — total must match receivables summary paidTotal. */
export const SEED_PAID_INVOICES: MockInvoice[] = [
  { id: "inv-p01", date: "5/20/26", number: "06140", customerId: "c-globe", amount: 64_684.5, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/20/26", false) },
  { id: "inv-p02", date: "5/19/26", number: "06138", customerId: "c-prime", amount: 156_780, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/19/26", false) },
  { id: "inv-p03", date: "5/18/26", number: "06135", customerId: "c-aprlyn", amount: 15_000, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/18/26", false) },
  { id: "inv-p04", date: "5/17/26", number: "06132", customerId: "c-abc", amount: 45_200, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/17/26", true) },
  { id: "inv-p05", date: "5/16/26", number: "06130", customerId: "c-rorobus", amount: 28_500, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/16/26", true) },
  { id: "inv-p06", date: "5/15/26", number: "06128", customerId: "c-cebu", amount: 12_890.5, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/15/26", true) },
  { id: "inv-p07", date: "5/14/26", number: "06125", customerId: "c-manila", amount: 8_450, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/14/26", true) },
  { id: "inv-p08", date: "5/13/26", number: "06122", customerId: "c-juan", amount: 5_250, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/13/26", true) },
  { id: "inv-p09", date: "5/12/26", number: "06120", customerId: "c-michelle", amount: 18_500, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/12/26", true) },
  { id: "inv-p10", date: "5/11/26", number: "06118", customerId: "c-hartwell", amount: 40_062, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/11/26", true) },
  { id: "inv-p11", date: "5/10/26", number: "06115", customerId: "c-apple", amount: 22_000, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/10/26", true) },
  { id: "inv-p12", date: "5/09/26", number: "06112", customerId: "c-nguyen", amount: 14_000, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/09/26", true) },
  { id: "inv-p13", date: "5/08/26", number: "06110", customerId: "c-elvy", amount: 18_200, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/08/26", true) },
  { id: "inv-p14", date: "5/07/26", number: "06108", customerId: "c-elaika", amount: 9_000, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/07/26", true) },
  { id: "inv-p15", date: "5/06/26", number: "06105", customerId: "c-aaron", amount: 3_500, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/06/26", true) },
  { id: "inv-p16", date: "5/05/26", number: "06102", customerId: "c-globe", amount: 12_000, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/05/26", true) },
  { id: "inv-p17", date: "5/04/26", number: "06100", customerId: "c-prime", amount: 28_400, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/04/26", true) },
  { id: "inv-p18", date: "5/03/26", number: "06098", customerId: "c-abc", amount: 19_250, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/03/26", true) },
  { id: "inv-p19", date: "5/02/26", number: "06095", customerId: "c-aprlyn", amount: 11_500, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/02/26", true) },
  { id: "inv-p20", date: "5/01/26", number: "06092", customerId: "c-cebu", amount: 8_750, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("5/01/26", true) },
  { id: "inv-p21", date: "4/30/26", number: "06090", customerId: "c-manila", amount: 6_200, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("4/30/26", true) },
  { id: "inv-p22", date: "4/29/26", number: "06088", customerId: "c-juan", amount: 4_800, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("4/29/26", true) },
  { id: "inv-p23", date: "4/28/26", number: "06085", customerId: "c-michelle", amount: 7_250, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("4/28/26", true) },
  { id: "inv-p24", date: "4/27/26", number: "06082", customerId: "c-rorobus", amount: 35_083.75, balanceDue: 0, kind: "paid", statusTimeline: paidInvoiceTimeline("4/27/26", true) },
];
