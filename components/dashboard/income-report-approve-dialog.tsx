import { BankAccountSelectItem } from "@/components/admin/bank-account-select-item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BankAccount } from "@/lib/actions/bank-accounts";
import { useLanguage } from "@/lib/i18n/context";
import { useCurrency } from "@/lib/i18n/currency";
import { IncomeReport } from "@/lib/types/income-report";
import { sortBankAccounts } from "@/lib/utils/sort-bank-accounts";

interface IncomeReportApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: IncomeReport | null;
  bankAccounts: BankAccount[];
  selectedCashAccount: number | null;
  selectedCardAccount: number | null;
  onCashAccountChange: (accountId: number) => void;
  onCardAccountChange: (accountId: number) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string;
  success: string;
  getTotalAmount: (report: IncomeReport) => number;
}

export const IncomeReportApproveDialog = ({
  open,
  onOpenChange,
  report,
  bankAccounts,
  selectedCashAccount,
  selectedCardAccount,
  onCashAccountChange,
  onCardAccountChange,
  onConfirm,
  isSubmitting,
  error,
  success,
  getTotalAmount,
}: IncomeReportApproveDialogProps) => {
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("incomeApproval.reviewReport")}</DialogTitle>
          <DialogDescription>
            {t("incomeApproval.selectAccounts")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("incomeApproval.employee")}
              </p>
              <p className="font-semibold">
                {report.employee_profile
                  ? `${report.employee_profile.first_name} ${report.employee_profile.last_name}`
                  : t("incomeApproval.unknownEmployee")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("incomeApproval.totalAmount")}
              </p>
              <p className="font-bold text-lg">
                {formatAmount(getTotalAmount(report), "BGN")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("incomeApproval.cash")}
              </p>
              <p className="font-semibold">
                {formatAmount(report.cash_sales, "BGN")}
              </p>
              {report.cash_tips > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {formatAmount(report.cash_tips, "BGN")}{" "}
                  {t("incomeApproval.cashTips").toLowerCase()} (
                  {t("common.recorded")})
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("incomeApproval.cardPos")}
              </p>
              <p className="font-semibold">
                {formatAmount(report.card_sales + report.card_tips, "BGN")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("incomeApproval.cashAccount")}</Label>
            <Select
              value={selectedCashAccount?.toString()}
              onValueChange={(val) => onCashAccountChange(Number(val))}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("incomeApproval.selectCashAccount")}
                />
              </SelectTrigger>
              <SelectContent>
                {sortBankAccounts(
                  bankAccounts.filter((acc) => acc.account_type === "cash")
                ).map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    <BankAccountSelectItem account={account} showBalance />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("incomeApproval.cardPosAccount")}</Label>
            <Select
              value={selectedCardAccount?.toString()}
              onValueChange={(val) => onCardAccountChange(Number(val))}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("incomeApproval.selectCardAccount")}
                />
              </SelectTrigger>
              <SelectContent>
                {sortBankAccounts(
                  bankAccounts.filter(
                    (acc) =>
                      acc.account_type === "bank" || acc.account_type === "pos"
                  )
                ).map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    <BankAccountSelectItem account={account} showBalance />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            {success}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              isSubmitting || !selectedCashAccount || !selectedCardAccount
            }
          >
            {isSubmitting
              ? t("incomeApproval.approving")
              : t("incomeApproval.approveDeposit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
