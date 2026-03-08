import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  api,
  type Transaction,
  type TransactionListResponse,
  type Category,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

type FilterMode = "all" | "unclassified" | "classified";

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  if (confidence >= 0.85)
    return <Badge variant="success">{(confidence * 100).toFixed(0)}%</Badge>;
  if (confidence >= 0.5)
    return <Badge variant="warning">{(confidence * 100).toFixed(0)}%</Badge>;
  return <Badge variant="secondary">{(confidence * 100).toFixed(0)}%</Badge>;
}

function ClassifyCell({
  transaction,
  categories,
  onClassify,
}: {
  transaction: Transaction;
  categories: Category[];
  onClassify: (txnId: number, categoryId: number, merchant?: string) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<number | "">(
    transaction.predicted_category_id ?? ""
  );

  if (transaction.final_category_id) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default">{transaction.final_category_name}</Badge>
        <span className="text-xs text-muted-foreground">
          ({transaction.classification_source})
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {transaction.predicted_category_name && (
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">
            Suggestion: {transaction.predicted_category_name}
          </span>
          <ConfidenceBadge confidence={transaction.confidence} />
        </div>
      )}
      <Select
        value={selectedCat}
        onChange={(e) => setSelectedCat(Number(e.target.value) || "")}
        className="w-40"
      >
        <option value="">Select...</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parent_id ? "\u00A0\u00A0" : ""}
            {c.name}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        disabled={!selectedCat}
        onClick={() => {
          if (selectedCat) onClassify(transaction.id, selectedCat);
        }}
      >
        Assign
      </Button>
      {transaction.predicted_category_id && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onClassify(transaction.id, transaction.predicted_category_id!)
          }
        >
          Accept
        </Button>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params: { page: number; page_size: number; classified?: boolean } = {
      page,
      page_size: 50,
    };
    if (filter === "classified") params.classified = true;
    if (filter === "unclassified") params.classified = false;
    api.getTransactions(params).then(setData).catch((e) => setError(e.message));
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  const handleClassify = async (
    txnId: number,
    categoryId: number,
    merchant?: string
  ) => {
    try {
      await api.classifyTransaction(txnId, {
        category_id: categoryId,
        merchant,
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed");
    }
  };

  const handleClassifyAll = async () => {
    try {
      const result = await api.classifyAll();
      setError("");
      alert(`Pipeline ran on ${result.processed} transactions`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classify all failed");
    }
  };

  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClassifyAll}>
            <Sparkles className="h-4 w-4" />
            Run ML on Unclassified
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "unclassified", "classified"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        {data && (
          <span className="text-sm text-muted-foreground self-center ml-2">
            {data.total} transactions
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Merchant</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={txn.raw_description}>
                      {txn.description}
                    </td>
                    <td className="p-3 whitespace-nowrap">{txn.merchant}</td>
                    <td
                      className={`p-3 text-right whitespace-nowrap font-mono ${
                        txn.amount >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="p-3">
                      <ClassifyCell
                        transaction={txn}
                        categories={categories}
                        onClassify={handleClassify}
                      />
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No transactions found. Upload a bank statement to get
                      started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
