# Calculation Specification v1

## Locked definitions

```text
Net Sales = Gross Sales - Discounts - Refunds
COGS = sum(quantity sold × unit-cost snapshot at sale posting)
Gross Profit = Net Sales - COGS
Contribution Profit = Gross Profit - marketplace fees - payment fees - shipping subsidies - affiliate fees - ad spend - return losses
Available Stock = On Hand - Reservations
Weighted Average Cost = (old quantity × old average + received quantity × landed unit cost) / (old quantity + received quantity)
```

Revenue in UI means Net Sales unless explicitly labeled. Cashflow is separate from profit.

## Golden hand calculation

Ten units are received at IDR 80,000 each (purchase cash out IDR 800,000). Five sell at IDR 150,000. Discounts are IDR 25,000; refund IDR 150,000. Marketplace fee is IDR 28,750, payment fee IDR 5,750, shipping subsidy IDR 20,000, spend IDR 100,000, and return loss IDR 10,000.

```text
Net sales            750,000 - 25,000 - 150,000 = 575,000
COGS                 5 × 80,000                  = 400,000
Gross profit         575,000 - 400,000           = 175,000
Contribution profit  175,000 - 28,750 - 5,750 - 20,000 - 100,000 - 10,000 = 10,500
Cash in              575,000 - 28,750 - 5,750    = 540,500
Cash out             800,000 + 100,000 + 20,000 + 10,000 = 930,000
Net cashflow          540,500 - 930,000           = -389,500
```

Executable proof: `scripts/calculate-scenario.mjs`; its test must equal this result.
