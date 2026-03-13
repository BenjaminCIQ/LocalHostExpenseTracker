import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { TRANSFER_LINKED_EVENT } from "@/lib/transferReviewDefaults";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TransactionComparisonPane({
  transactionId,
  title,
  date,
  amount,
  merchant,
  description,
  rawDescription,
  currency,
  kind,
  isInternalTransfer,
  transferGroupId,
  disabled,
  onChanged,
}: {
  transactionId: number;
  title: string;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  rawDescription: string;
  currency: string;
  kind: string;
  isInternalTransfer: boolean;
  transferGroupId: string | null;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [showMore, setShowMore] = useState(false);
  const [raw, setRaw] = useState<{ raw_row_json: string | null; raw_row_line: string | null } | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(date);
  const [editAmount, setEditAmount] = useState(amount);
  const [editMerchant, setEditMerchant] = useState(merchant);
  const [editDescription, setEditDescription] = useState(description);
  const [editRawDescription, setEditRawDescription] = useState(rawDescription);
  const [editCurrency, setEditCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">{title}</div>
        <Badge variant={kind === "transfer" || isInternalTransfer ? "secondary" : "default"}>
          {kind || "unknown"}
        </Badge>
      </div>
      <div className="text-sm">{formatDate(date)} · {formatCurrency(amount)} · {currency}</div>
      <div className="text-sm">{merchant || "Unknown merchant"}</div>
      <div className="text-xs text-muted-foreground break-words">{description || "-"}</div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/transactions?focus_txn_id=${transactionId}`}>
          <Button size="sm" variant="outline">Go to transaction</Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setLoadingRaw(true);
            setShowMore((v) => !v);
            if (!raw) {
              try {
                const data = await api.getTransactionRaw(transactionId);
                setRaw(data);
              } finally {
                setLoadingRaw(false);
              }
            } else {
              setLoadingRaw(false);
            }
          }}
        >
          {showMore ? "Hide details" : "Show details"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.updateTransaction(transactionId, {
                transaction_kind: "transfer",
                is_internal_transfer: true,
              });
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Mark transfer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.unlinkTransfer(transactionId);
              window.dispatchEvent(new Event(TRANSFER_LINKED_EVENT));
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Unlink
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.updateTransaction(transactionId, {
                transaction_kind:
                  amount > 0 ? "income" : amount < 0 ? "expense" : "adjustment",
                is_internal_transfer: false,
                transfer_group_id: null,
                transfer_linked_transaction_id: null,
                transfer_confidence: null,
                transfer_match_source: null,
              });
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Unmark transfer
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((v) => !v)}
          disabled={disabled || saving}
        >
          {editing ? "Cancel edit" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="grid gap-2 md:grid-cols-2">
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value.toUpperCase())} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm md:col-span-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm md:col-span-2" value={editRawDescription} onChange={(e) => setEditRawDescription(e.target.value)} />
          <div className="md:col-span-2 flex justify-end">
            <Button
              size="sm"
              disabled={disabled || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await api.updateTransaction(transactionId, {
                    date: editDate,
                    amount: editAmount,
                    currency: editCurrency,
                    merchant: editMerchant,
                    description: editDescription,
                    raw_description: editRawDescription,
                  });
                  setEditing(false);
                  await onChanged();
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save edit
            </Button>
          </div>
        </div>
      )}

      {showMore && (
        <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
          {loadingRaw ? (
            <div className="text-muted-foreground">Loading raw data...</div>
          ) : (
            <div className="space-y-2">
              {transferGroupId && (
                <div>
                  <span className="text-muted-foreground">Transfer group:</span> {transferGroupId}
                </div>
              )}
              {raw?.raw_row_line ? (
                <pre className="whitespace-pre-wrap break-words">{raw.raw_row_line}</pre>
              ) : (
                <div className="text-muted-foreground">No raw line available.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
