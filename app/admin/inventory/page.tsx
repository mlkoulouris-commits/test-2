import { InventoryPageClient } from "@/components/admin/inventory-page-client";
import { getInventoryLocations } from "@/lib/actions/admin-inventory";

export default async function InventoryPage() {
  const { data: locations } = await getInventoryLocations();

  return <InventoryPageClient locations={locations || []} />;
}
