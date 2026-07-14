export const CUSTOMERS_LIST_PATH = "/customers/list";

/** Query flag to open the new-customer dialog on the customers list page. */
export const NEW_CUSTOMER_SEARCH_PARAM = "newCustomer";

export function customersListHref(openNewCustomerDialog = false): string {
  if (!openNewCustomerDialog) return CUSTOMERS_LIST_PATH;
  return `${CUSTOMERS_LIST_PATH}?${NEW_CUSTOMER_SEARCH_PARAM}=1`;
}
