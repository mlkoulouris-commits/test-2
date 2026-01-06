"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/lib/i18n/context";
import { FileCode, Code2 } from "lucide-react";
import { getAccountsByCodes } from "@/lib/actions/chart-of-accounts";

interface HardcodedMapping {
  file: string;
  accountCodes: string[];
  purpose: string;
  lineNumbers: string;
  type: "revenue" | "cogs" | "personnel" | "heuristic";
}

const hardcodedMappings: HardcodedMapping[] = [
  {
    file: "lib/actions/effective-coa-mappings.ts",
    accountCodes: ["1101", "1103", "1104", "2101", "2102", "2106"],
    purpose: "Heuristic mapping based on category classification (food, alcoholic, non-alcoholic)",
    lineNumbers: "224-242, 370, 559",
    type: "heuristic",
  },
  {
    file: "lib/actions/profit-loss.ts",
    accountCodes: ["1101", "1103", "1104"],
    purpose: "Revenue account categorization for P&L reports",
    lineNumbers: "252-254",
    type: "revenue",
  },
  {
    file: "lib/actions/profit-loss.ts",
    accountCodes: ["2101", "2102", "2106"],
    purpose: "COGS account categorization for P&L reports",
    lineNumbers: "405-407",
    type: "cogs",
  },
  {
    file: "lib/actions/profit-loss.ts",
    accountCodes: ["31*"],
    purpose: "Default personnel account (code prefix starts with '31')",
    lineNumbers: "794",
    type: "personnel",
  },
  {
    file: "lib/actions/cashflow.ts",
    accountCodes: ["1101", "1103", "1104"],
    purpose: "Revenue account categorization for cash flow reports",
    lineNumbers: "262-264",
    type: "revenue",
  },
  {
    file: "lib/actions/cashflow.ts",
    accountCodes: ["31*"],
    purpose: "Default personnel account (code prefix starts with '31')",
    lineNumbers: "127",
    type: "personnel",
  },
];

const getTypeColor = (type: HardcodedMapping["type"]) => {
  switch (type) {
    case "revenue":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "cogs":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "personnel":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "heuristic":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getTypeLabel = (type: HardcodedMapping["type"], locale: string) => {
  const labels: Record<string, { en: string; bg: string }> = {
    revenue: { en: "Revenue", bg: "Приходи" },
    cogs: { en: "COGS", bg: "Себестойност" },
    personnel: { en: "Personnel", bg: "Персонал" },
    heuristic: { en: "Heuristic", bg: "Евристика" },
  };
  return labels[type]?.[locale as "en" | "bg"] || type;
};

interface AccountInfo {
  code: string;
  name: string;
  nameBg: string | null;
}

export const HardcodedMappingsTable = () => {
  const { locale } = useLanguage();
  const [accountMap, setAccountMap] = useState<Map<string, AccountInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      // Get all unique account codes (excluding wildcards like "31*")
      const allCodes = hardcodedMappings
        .flatMap((m) => m.accountCodes)
        .filter((code) => !code.includes("*"))
        .filter((code, index, arr) => arr.indexOf(code) === index);

      const result = await getAccountsByCodes(allCodes);
      if (result.data) {
        const map = new Map<string, AccountInfo>();
        result.data.forEach((account) => {
          map.set(account.code, {
            code: account.code,
            name: account.name,
            nameBg: account.name_bg,
          });
        });
        setAccountMap(map);
      }
      setLoading(false);
    };

    fetchAccounts();
  }, []);

  const getAccountName = (code: string): string | null => {
    // Handle wildcard codes like "31*"
    if (code.includes("*")) {
      return null; // Can't show specific name for wildcard
    }
    const account = accountMap.get(code);
    if (!account) return null;
    return locale === "bg" && account.nameBg ? account.nameBg : account.name;
  };

  const AccountCodeBadge = ({ code }: { code: string }) => {
    const accountName = getAccountName(code);
    const badge = (
      <Badge variant="outline" className="font-mono">
        {code}
      </Badge>
    );

    if (!accountName) return badge;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <span className="font-medium">{accountName}</span>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          {locale === "bg" ? "Хардкодирани мапирания" : "Hardcoded Mappings"}
        </CardTitle>
        <CardDescription>
          {locale === "bg"
            ? "Всички хардкодирани сметки в кода, които се използват за автоматично мапиране"
            : "All hardcoded account codes in the codebase used for automatic mapping"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">
                  {locale === "bg" ? "Файл" : "File"}
                </TableHead>
                <TableHead className="w-[15%]">
                  {locale === "bg" ? "Тип" : "Type"}
                </TableHead>
                <TableHead className="w-[20%]">
                  {locale === "bg" ? "Код на сметка" : "Account Code(s)"}
                </TableHead>
                <TableHead className="w-[25%]">
                  {locale === "bg" ? "Назначение" : "Purpose"}
                </TableHead>
                <TableHead className="w-[10%]">
                  {locale === "bg" ? "Редове" : "Lines"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hardcodedMappings.map((mapping, index) => (
                <TableRow key={index} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span>{mapping.file}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(mapping.type)}>
                      {getTypeLabel(mapping.type, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {mapping.accountCodes.map((code, codeIndex) => (
                        <AccountCodeBadge key={codeIndex} code={code} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {mapping.purpose}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {mapping.lineNumbers}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 rounded-lg border bg-muted/50 p-4">
          <h3 className="mb-3 font-semibold">
            {locale === "bg" ? "Обобщение" : "Summary"}
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">
                {locale === "bg" ? "Общо хардкодирани кодове:" : "Total hardcoded codes:"}
              </p>
              <p className="text-2xl font-bold">
                {new Set(hardcodedMappings.flatMap((m) => m.accountCodes)).size}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">
                {locale === "bg" ? "Файлове с хардкодирани стойности:" : "Files with hardcoded values:"}
              </p>
              <p className="text-2xl font-bold">
                {new Set(hardcodedMappings.map((m) => m.file)).size}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
