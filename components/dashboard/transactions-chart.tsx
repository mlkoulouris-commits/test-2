"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DailySalesReport } from "@/lib/actions/sales-report";
import { format } from "date-fns";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  cashTransactions: {
    label: "Cash",
    color: "hsl(var(--foreground))",
  },
  cardTransactions: {
    label: "Card",
    color: "hsl(var(--foreground))",
  },
  walletTransactions: {
    label: "Wallet",
    color: "hsl(var(--foreground))",
  },
  totalTransactions: {
    label: "Total",
    color: "hsl(var(--foreground))",
  },
} satisfies ChartConfig;

interface TransactionsChartProps {
  data: DailySalesReport[];
  startDate?: Date;
  endDate?: Date;
}

export const TransactionsChart = ({
  data,
  startDate,
  endDate,
}: TransactionsChartProps) => {
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("totalTransactions");

  const total = React.useMemo(
    () => ({
      cashTransactions: data.reduce(
        (acc, curr) => acc + curr.cashTransactions,
        0
      ),
      cardTransactions: data.reduce(
        (acc, curr) => acc + curr.cardTransactions,
        0
      ),
      walletTransactions: data.reduce(
        (acc, curr) => acc + curr.walletTransactions,
        0
      ),
      totalTransactions: data.reduce(
        (acc, curr) => acc + curr.regularTransactions,
        0
      ),
    }),
    [data]
  );

  // Fill in missing dates with zero values
  const chartData = React.useMemo(() => {
    if (!startDate || !endDate || data.length === 0) return data;

    const dataMap = new Map(data.map((d) => [d.date, d]));
    const filledData: DailySalesReport[] = [];

    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = format(currentDate, "yyyy-MM-dd");

      if (dataMap.has(dateStr)) {
        filledData.push(dataMap.get(dateStr)!);
      } else {
        // Add empty data for missing dates
        filledData.push({
          date: dateStr,
          totalSales: 0,
          totalTransactions: 0,
          zeroAmountTransactions: 0,
          zeroAmountItemsSum: 0,
          regularSales: 0,
          regularTransactions: 0,
          cashSales: 0,
          cashTransactions: 0,
          cardSales: 0,
          cardTransactions: 0,
          invoiceSales: 0,
          invoiceTransactions: 0,
          compSales: 0,
          compTransactions: 0,
          walletSales: 0,
          walletTransactions: 0,
          noPaymentSales: 0,
          noPaymentTransactions: 0,
          tips: 0,
          waste: 0,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return filledData;
  }, [data, startDate, endDate]);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-0">
          <CardTitle>Transaction Counts</CardTitle>
          <CardDescription>
            Daily transactions by payment method
          </CardDescription>
        </div>
        <div className="flex">
          {(
            [
              "totalTransactions",
              "cashTransactions",
              "cardTransactions",
              "walletTransactions",
            ] as const
          ).map((key) => {
            const chart = key as keyof typeof chartConfig;
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-4 py-3 text-left even:border-l sm:border-t-0 sm:border-l sm:px-6 sm:py-4"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-muted-foreground text-xs">
                  {chartConfig[chart].label}
                </span>
                <span className="text-base leading-none font-bold whitespace-nowrap sm:text-2xl">
                  {total[key].toLocaleString("en-US")}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const [year, month, day] = value.split("-").map(Number);
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => Math.round(value).toString()}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="transactions"
                  labelFormatter={(value: string) => {
                    const [year, month, day] = value.split("-").map(Number);
                    const date = new Date(year, month - 1, day);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                  formatter={(value: number | string) => {
                    return [Math.round(Number(value)).toLocaleString("en-US")];
                  }}
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={`var(--color-${activeChart})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
