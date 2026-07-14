import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getDashboardSnapshot,
  getReceivablesSnapshot,
} from "../../src/lib/mock-data/store";

type ListParams = Record<string, unknown> | undefined;
type QueryOptions = { query?: { queryKey?: readonly unknown[] } };

function listQueryKey(resource: string, params?: ListParams) {
  return [resource, "list", params] as const;
}

function useListStub(
  resource: string,
  params?: ListParams,
  _options?: QueryOptions,
): UseQueryResult<any[]> {
  return useQuery({
    queryKey: _options?.query?.queryKey ?? listQueryKey(resource, params),
    queryFn: async () => [],
  });
}

function useMutationStub<TData = unknown, TVariables = unknown>(): UseMutationResult<
  TData,
  Error,
  TVariables
> {
  return useMutation({
    mutationFn: async () => ({}) as TData,
  });
}

export function useGetDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => getDashboardSnapshot(),
  });
}

export function useGetSalesOverview() {
  return useQuery({
    queryKey: ["sales", "overview"],
    queryFn: async () => {
      const receivables = getReceivablesSnapshot().summary;
      const dashboard = getDashboardSnapshot();
      return {
        totalSales: dashboard.sales.totalAmount,
        totalReceived: receivables.paidTotal,
        outstanding: receivables.unpaidTotal,
        overdue: receivables.overdueAmount,
        invoiceCount: receivables.unpaidCount + receivables.paidCount,
        paidCount: receivables.paidCount,
        overdueCount: receivables.overdueCount,
        draftCount: 0,
      };
    },
  });
}

export const getListBankTransactionsQueryKey = (params?: ListParams) =>
  listQueryKey("bank-transactions", params);
export const useListBankTransactions = (params?: ListParams, options?: QueryOptions) =>
  useListStub("bank-transactions", params, options);
export const useCreateBankTransaction = () => useMutationStub();
export const useUpdateBankTransaction = () => useMutationStub();
export const useDeleteBankTransaction = () => useMutationStub();

export const getListIntegrationTransactionsQueryKey = (params?: ListParams) =>
  listQueryKey("integration-transactions", params);
export const useListIntegrationTransactions = (params?: ListParams, options?: QueryOptions) =>
  useListStub("integration-transactions", params, options);
export const useUpdateIntegrationTransaction = () => useMutationStub();
export const useDeleteIntegrationTransaction = () => useMutationStub();

export const getListReconciliationsQueryKey = (params?: ListParams) =>
  listQueryKey("reconciliations", params);
export const useListReconciliations = (params?: ListParams, options?: QueryOptions) =>
  useListStub("reconciliations", params, options);
export const useCreateReconciliation = () => useMutationStub();
export const useUpdateReconciliation = () => useMutationStub();

export const getListRulesQueryKey = (params?: ListParams) => listQueryKey("rules", params);
export const useListRules = (params?: ListParams, options?: QueryOptions) =>
  useListStub("rules", params, options);
export const useCreateRule = () => useMutationStub();
export const useUpdateRule = () => useMutationStub();
export const useDeleteRule = () => useMutationStub();

export const getListAccountsQueryKey = (params?: ListParams) => listQueryKey("accounts", params);
export const useListAccounts = (params?: ListParams, options?: QueryOptions) =>
  useListStub("accounts", params, options);
export const useCreateAccount = () => useMutationStub();
export const useUpdateAccount = () => useMutationStub();
export const useDeleteAccount = () => useMutationStub();

export const getListRecurringTransactionsQueryKey = (params?: ListParams) =>
  listQueryKey("recurring-transactions", params);
export const useListRecurringTransactions = (params?: ListParams, options?: QueryOptions) =>
  useListStub("recurring-transactions", params, options);
export const useCreateRecurringTransaction = () => useMutationStub();
export const useUpdateRecurringTransaction = () => useMutationStub();
export const useDeleteRecurringTransaction = () => useMutationStub();

export const getListExpenseTransactionsQueryKey = (params?: ListParams) =>
  listQueryKey("expense-transactions", params);
export const useListExpenseTransactions = (params?: ListParams, options?: QueryOptions) =>
  useListStub("expense-transactions", params, options);
export const useCreateExpenseTransaction = () => useMutationStub();
export const useUpdateExpenseTransaction = () => useMutationStub();
export const useDeleteExpenseTransaction = () => useMutationStub();

export const getListSuppliersQueryKey = (params?: ListParams) => listQueryKey("suppliers", params);
export const useListSuppliers = (params?: ListParams, options?: QueryOptions) =>
  useListStub("suppliers", params, options);
export const useCreateSupplier = () => useMutationStub();
export const useUpdateSupplier = () => useMutationStub();
export const useDeleteSupplier = () => useMutationStub();

export const getListBillsQueryKey = (params?: ListParams) => listQueryKey("bills", params);
export const useListBills = (params?: ListParams, options?: QueryOptions) =>
  useListStub("bills", params, options);
export const useCreateBill = () => useMutationStub();
export const useUpdateBill = () => useMutationStub();
export const useDeleteBill = () => useMutationStub();
export const usePayBill = () => useMutationStub();

export const getListSalesTransactionsQueryKey = (params?: ListParams) =>
  listQueryKey("sales-transactions", params);
export const useListSalesTransactions = (params?: ListParams, options?: QueryOptions) =>
  useListStub("sales-transactions", params, options);
export const useCreateSalesTransaction = () => useMutationStub();
export const useUpdateSalesTransaction = () => useMutationStub();
export const useDeleteSalesTransaction = () => useMutationStub();

export const getListInvoicesQueryKey = (params?: ListParams) => listQueryKey("invoices", params);
export const useListInvoices = (params?: ListParams, options?: QueryOptions) =>
  useListStub("invoices", params, options);
export const useCreateInvoice = () => useMutationStub();
export const useUpdateInvoice = () => useMutationStub();
export const useDeleteInvoice = () => useMutationStub();
export const useSendInvoice = () => useMutationStub();

export const getListSalesOrdersQueryKey = (params?: ListParams) =>
  listQueryKey("sales-orders", params);
export const useListSalesOrders = (params?: ListParams, options?: QueryOptions) =>
  useListStub("sales-orders", params, options);
export const useCreateSalesOrder = () => useMutationStub();
export const useUpdateSalesOrder = () => useMutationStub();
export const useDeleteSalesOrder = () => useMutationStub();

export const getListProductsQueryKey = (params?: ListParams) => listQueryKey("products", params);
export const useListProducts = (params?: ListParams, options?: QueryOptions) =>
  useListStub("products", params, options);
export const useCreateProduct = () => useMutationStub();
export const useUpdateProduct = () => useMutationStub();
export const useDeleteProduct = () => useMutationStub();
