import type { ImportedBalanceSheetAccountRow } from "@/lib/balance-sheet-summary-import";
import type { ReportLine } from "@/views/financial-report-shared";

function sumRowAmounts(rows: ImportedBalanceSheetAccountRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function accountLine(row: ImportedBalanceSheetAccountRow): ReportLine {
  return {
    id: `bs-acct-${row.section}-${row.sortOrder}-${row.accountName}`,
    label: row.accountName,
    amount: row.amount,
  };
}

function isShareholdersEquityLabel(label: string): boolean {
  return /^shareholders?'? equity$/i.test(label.trim());
}

function buildGroupNode(
  groupName: string,
  parentPath: string,
  rows: ImportedBalanceSheetAccountRow[],
  idPrefix: string,
): ReportLine | null {
  const fullPath = parentPath ? `${parentPath}|${groupName}` : groupName;
  const accounts = rows
    .filter((row) => row.groupPath === fullPath)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(accountLine);

  const childGroupNames = new Set<string>();
  for (const row of rows) {
    if (!row.groupPath.startsWith(`${fullPath}|`)) continue;
    const rest = row.groupPath.slice(fullPath.length + 1);
    childGroupNames.add(rest.split("|")[0]);
  }

  const childGroups = [...childGroupNames]
    .sort((a, b) => {
      const orderA = rows.find((row) => row.groupPath.startsWith(`${fullPath}|${a}`))?.sortOrder ?? 0;
      const orderB = rows.find((row) => row.groupPath.startsWith(`${fullPath}|${b}`))?.sortOrder ?? 0;
      return orderA - orderB;
    })
    .map((name) => buildGroupNode(name, fullPath, rows, idPrefix))
    .filter((node): node is ReportLine => node !== null);

  const children: ReportLine[] = [...childGroups, ...accounts];
  if (children.length === 0) return null;

  const accountTotal = accounts.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const groupTotal = childGroups.reduce((sum, group) => sum + (group.amount ?? 0), 0);
  const total = accountTotal + groupTotal;

  return {
    id: `${idPrefix}-${fullPath}`,
    label: groupName,
    amount: total,
    defaultOpen: children.length > 0,
    children: [
      ...children,
      {
        id: `${idPrefix}-total-${fullPath}`,
        label: `Total for ${groupName}`,
        amount: total,
        isSectionTotal: true,
      },
    ],
  };
}

function buildSectionTree(
  rows: ImportedBalanceSheetAccountRow[],
  idPrefix: string,
): ReportLine[] {
  const topGroups = new Set<string>();
  for (const row of rows) {
    const top = row.groupPath.split("|")[0];
    if (top) topGroups.add(top);
  }

  return [...topGroups]
    .sort((a, b) => {
      const orderA = rows.find((row) => row.groupPath.startsWith(a))?.sortOrder ?? 0;
      const orderB = rows.find((row) => row.groupPath.startsWith(b))?.sortOrder ?? 0;
      return orderA - orderB;
    })
    .map((groupName) => buildGroupNode(groupName, "", rows, idPrefix))
    .filter((node): node is ReportLine => node !== null);
}

function buildEquitySection(
  equityAccountRows: ImportedBalanceSheetAccountRow[],
  netIncomeRows: ImportedBalanceSheetAccountRow[],
): ReportLine[] {
  const equityGroups = buildSectionTree(equityAccountRows, "equity");
  const netIncomeLines = netIncomeRows.map(accountLine);
  const totalEquity = sumRowAmounts(equityAccountRows) + sumRowAmounts(netIncomeRows);

  let innerChildren: ReportLine[];
  if (
    equityGroups.length === 1 &&
    isShareholdersEquityLabel(equityGroups[0].label) &&
    equityGroups[0].children
  ) {
    innerChildren = [
      ...equityGroups[0].children.filter((child) => !child.isSectionTotal),
      ...netIncomeLines,
    ];
  } else {
    innerChildren = [...equityGroups, ...netIncomeLines];
  }

  innerChildren.push({
    id: "total-equity",
    label: "Total for Shareholders' equity",
    amount: totalEquity,
    isSectionTotal: true,
  });

  return [
    {
      id: "shareholders-equity",
      label: "Shareholders' equity",
      amount: totalEquity,
      defaultOpen: true,
      children: innerChildren,
    },
  ];
}

export function buildBalanceSheetLinesFromImport(
  snapshot: { periodLabel: string; rows: ImportedBalanceSheetAccountRow[] },
): ReportLine[] {
  const assetRows = snapshot.rows.filter((row) => row.section === "assets");
  const liabilityRows = snapshot.rows.filter((row) => row.section === "liabilities");
  const equityAccountRows = snapshot.rows.filter((row) => row.section === "equity");
  const netIncomeRows = snapshot.rows.filter((row) => row.section === "net_income");

  const assetGroups = buildSectionTree(assetRows, "asset");
  const totalAssets = sumRowAmounts(assetRows);

  const liabilityGroups = buildSectionTree(liabilityRows, "liability");
  const totalLiabilities = sumRowAmounts(liabilityRows);

  const equitySection = buildEquitySection(equityAccountRows, netIncomeRows);
  const totalEquity = sumRowAmounts(equityAccountRows) + sumRowAmounts(netIncomeRows);

  const liabilitiesAndEquityChildren: ReportLine[] = [
    ...liabilityGroups,
    ...equitySection,
    {
      id: "total-liabilities-equity",
      label: "Total for Liabilities and Shareholder's Equity",
      amount: totalLiabilities + totalEquity,
      isGrandTotal: true,
    },
  ];

  return [
    {
      id: "assets",
      label: "Assets",
      amount: totalAssets,
      defaultOpen: true,
      children: [
        ...assetGroups,
        {
          id: "total-assets",
          label: "Total for Assets",
          amount: totalAssets,
          isSectionTotal: true,
        },
      ],
    },
    {
      id: "liabilities-equity",
      label: "Liabilities and Shareholder's Equity",
      amount: totalLiabilities + totalEquity,
      defaultOpen: true,
      children: liabilitiesAndEquityChildren,
    },
  ];
}
