"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AccountType,
  ChartOfAccount,
  getAllAccounts,
} from "@/lib/actions/chart-of-accounts";
import { useLanguage } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface AccountSelectorProps {
  value: number | null;
  onChange: (accountId: number | null) => void;
  accountType?: AccountType;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

const accountTypeColors: Record<AccountType, string> = {
  revenue: "text-green-600 dark:text-green-400",
  cogs: "text-orange-600 dark:text-orange-400",
  labor: "text-yellow-600 dark:text-yellow-400",
  operating_expense: "text-blue-600 dark:text-blue-400",
  non_operating: "text-purple-600 dark:text-purple-400",
};

export const AccountSelector = ({
  value,
  onChange,
  accountType,
  label,
  placeholder,
  allowClear = true,
  disabled = false,
}: AccountSelectorProps) => {
  const { locale } = useLanguage();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [accountType]);

  const loadAccounts = async () => {
    setLoading(true);
    const [treeResult, flatResult] = await Promise.all([
      getAllAccounts({ accountType }),
      getAllAccounts({ accountType, flat: true }),
    ]);

    if (treeResult.data) {
      setAccounts(treeResult.data);
      // Expand level 1 by default
      const level1Ids = new Set<number>();
      treeResult.data.forEach((acc: ChartOfAccount) => {
        if (acc.level === 1) level1Ids.add(acc.id);
      });
      setExpandedIds(level1Ids);
    }

    if (flatResult.data) {
      setFlatAccounts(flatResult.data);
    }

    setLoading(false);
  };

  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return flatAccounts.find((a) => a.id === value);
  }, [value, flatAccounts]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;

    const searchLower = search.toLowerCase();
    const matchingIds = new Set<number>();

    // Find all matching accounts and their parents
    const findMatches = (accs: ChartOfAccount[]) => {
      accs.forEach((acc) => {
        const matches =
          acc.code.toLowerCase().includes(searchLower) ||
          acc.name.toLowerCase().includes(searchLower) ||
          (acc.name_bg && acc.name_bg.toLowerCase().includes(searchLower));

        if (matches) {
          matchingIds.add(acc.id);
        }

        if (acc.children) {
          findMatches(acc.children);
        }
      });
    };

    findMatches(accounts);

    // Filter tree to only show matching accounts and their parents
    const filterTree = (accs: ChartOfAccount[]): ChartOfAccount[] => {
      return accs
        .map((acc) => {
          const filteredChildren = acc.children ? filterTree(acc.children) : [];
          const hasMatchingChild = filteredChildren.length > 0;
          const selfMatches = matchingIds.has(acc.id);

          if (selfMatches || hasMatchingChild) {
            return { ...acc, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean) as ChartOfAccount[];
    };

    return filterTree(accounts);
  }, [accounts, search]);

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (account: ChartOfAccount) => {
    // Only allow selecting leaf accounts (level 3)
    if (account.level === 3) {
      onChange(account.id);
      setIsOpen(false);
      setSearch("");
    } else {
      // Toggle expand for non-leaf accounts
      handleToggleExpand(account.id);
    }
  };

  const renderAccount = (account: ChartOfAccount, depth: number = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const isSelected = value === account.id;
    const isSelectable = account.level === 3;

    return (
      <div key={account.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer",
            isSelectable && "hover:bg-accent",
            isSelected && "bg-accent",
            !isSelectable && "cursor-default"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleSelect(account)}
        >
          {hasChildren ? (
            <button
              className="h-4 w-4 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(account.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span
            className={cn(
              "font-mono text-xs",
              accountTypeColors[account.account_type]
            )}
          >
            {account.code}
          </span>
          <span
            className={cn(
              "flex-1 text-sm truncate",
              account.level === 1 && "font-semibold",
              !isSelectable && "text-muted-foreground"
            )}
          >
            {locale === "bg" && account.name_bg
              ? account.name_bg
              : account.name}
          </span>
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>
        {hasChildren &&
          isExpanded &&
          account.children?.map((child) => renderAccount(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between",
                !selectedAccount && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              {selectedAccount ? (
                <span className="flex items-center gap-2 truncate">
                  <span
                    className={cn(
                      "font-mono text-xs",
                      accountTypeColors[selectedAccount.account_type]
                    )}
                  >
                    {selectedAccount.code}
                  </span>
                  <span className="truncate">
                    {locale === "bg" && selectedAccount.name_bg
                      ? selectedAccount.name_bg
                      : selectedAccount.name}
                  </span>
                </span>
              ) : (
                <span>
                  {placeholder ||
                    (locale === "bg"
                      ? "Избери сметка..."
                      : "Select account...")}
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={locale === "bg" ? "Търсене..." : "Search..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="h-[300px] overflow-y-auto">
              <div className="p-2">
                {loading ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    {locale === "bg" ? "Зареждане..." : "Loading..."}
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    {locale === "bg"
                      ? "Няма намерени сметки"
                      : "No accounts found"}
                  </div>
                ) : (
                  filteredAccounts.map((account) => renderAccount(account))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {selectedAccount && allowClear && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6 p-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
