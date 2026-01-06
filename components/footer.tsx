"use client";

import { useLanguage } from "@/lib/i18n/context";

export const Footer = () => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Memento Group. {t("footer.allRightsReserved")}.
          </p>
        </div>
      </div>
    </footer>
  );
};
