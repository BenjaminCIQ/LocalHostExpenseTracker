import { useState } from "react";
import ImportProfilesPage from "@/pages/ImportProfilesPage";
import UploadPage from "@/pages/UploadPage";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { ButtonHint } from "@/components/HintTooltip";

type ImportTab = "upload" | "profiles";

const IMPORT_TABS: { value: ImportTab; label: string }[] = [
  { value: "upload", label: "Upload" },
  { value: "profiles", label: "Profiles" },
];

export default function ImportPage() {
  const [tab, setTab] = useState<ImportTab>("upload");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Import</h2>
        <div className="flex items-center gap-1">
          <Tabs value={tab} onChange={setTab} options={IMPORT_TABS} />
          {tab === "upload" ? <ButtonHint buttonId="upload-csv" /> : <ButtonHint buttonId="import-profiles" />}
        </div>
      </div>

      <TabPanel active={tab === "upload"}>
        <UploadPage embedded />
      </TabPanel>
      <TabPanel active={tab === "profiles"}>
        <ImportProfilesPage embedded />
      </TabPanel>
    </div>
  );
}
