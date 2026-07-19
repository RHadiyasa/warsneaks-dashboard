import { pathToFileURL } from "node:url";

export const money = (rupiah) => BigInt(rupiah);

export function calculateScenario(i) {
  const netSales = i.grossSales - i.discounts - i.refunds;
  const cogs = i.unitsSold * i.unitCostSnapshot;
  const grossProfit = netSales - cogs;
  const contributionProfit = grossProfit - i.marketplaceFees - i.paymentFees - i.shippingSubsidies - i.affiliateFees - i.adSpend - i.returnLosses;
  const cashIn = netSales - i.marketplaceFees - i.paymentFees;
  const cashOut = i.purchaseCashOut + i.adSpend + i.shippingSubsidies + i.affiliateFees + i.returnLosses;
  return { netSales, cogs, grossProfit, contributionProfit, cashIn, cashOut, netCashflow: cashIn - cashOut };
}

export const sampleInput = {
  grossSales: money(750000), discounts: money(25000), refunds: money(150000),
  unitsSold: money(5), unitCostSnapshot: money(80000), marketplaceFees: money(28750),
  paymentFees: money(5750), shippingSubsidies: money(20000), affiliateFees: money(0),
  adSpend: money(100000), returnLosses: money(10000), purchaseCashOut: money(800000),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(calculateScenario(sampleInput));
}
