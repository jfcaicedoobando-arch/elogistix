/** Approval fixes policy, never certifies a document, historical balance or bank. */
export const FINANCIAL_CRITERIA_APPROVAL = {
  approvedAt: '2026-10-13T12:32:00Z',
  population: 'documented-credit-own-v1',
  tax: 'documented-net-no-proration-v1',
  currency: 'document-currency-no-consolidation-v1',
  consumption: 'operating-cash-three-closed-months-v1',
  availability: 'reconciled-cash-explicit-restrictions-v1',
} as const;
