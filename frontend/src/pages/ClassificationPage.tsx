import { useState } from "react";
import OverridesPage from "@/pages/OverridesPage";
import RulesPage from "@/pages/RulesPage";
import { Tabs, TabPanel } from "@/components/ui/tabs";

type ClassificationTab = "rules" | "overrides";

const CLASSIFICATION_TABS: { value: ClassificationTab; label: string }[] = [
  { value: "rules", label: "Rules" },
  { value: "overrides", label: "Overrides" },
];

export default function ClassificationPage() {
  const [tab, setTab] = useState<ClassificationTab>("rules");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Classification</h2>
        <Tabs value={tab} onChange={setTab} options={CLASSIFICATION_TABS} />
      </div>

      <TabPanel active={tab === "rules"}>
        <RulesPage embedded />
      </TabPanel>
      <TabPanel active={tab === "overrides"}>
        <OverridesPage embedded />
      </TabPanel>
    </div>
  );
}
