import { recordBillCreation, recordExpenseCreation } from "@/lib/expense-transactions/record-expense";
import { getNextBillNumber, getNextExpenseNumber } from "@/lib/mock-data";
import {
  advanceRecurringDates,
  type MockRecurringTemplate,
} from "@/lib/mock-data/recurring-transactions";
import { updateRecurringTemplateViaApi } from "@/lib/recurring-templates/api";

export async function useRecurringTemplateNow(template: MockRecurringTemplate): Promise<void> {
  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  switch (template.txnType) {
    case "Expense":
      await recordExpenseCreation({
        date: dateLabel,
        type: "Expense",
        number: getNextExpenseNumber(),
        payee: template.customerSupplier === "—" ? template.templateName : template.customerSupplier,
        status: "paid",
        category: "Office Supplies",
        totalBeforeTax: template.amount,
        salesTax: 0,
        total: template.amount,
      });
      break;
    case "Bill": {
      const supplier =
        template.customerSupplier === "—" ? template.templateName : template.customerSupplier;
      await recordBillCreation({
        supplier,
        billDate: dateLabel,
        dueDate: template.nextDate || dateLabel,
        billNo: getNextBillNumber(),
        billAmount: template.amount,
        expenseCategory: "Office Supplies",
      });
      break;
    }
    default:
      throw new Error(`Use is not yet supported for ${template.txnType} templates.`);
  }

  const dates = advanceRecurringDates(template.nextDate, template.interval);
  await updateRecurringTemplateViaApi(template.id, {
    previousDate: dates.previousDate,
    nextDate: dates.nextDate,
  });
}
