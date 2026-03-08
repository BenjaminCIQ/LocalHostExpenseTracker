import { useEffect, useState } from "react";
import { Brain, RefreshCw, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type MlStatus } from "@/lib/api";

export default function MlStatusPage() {
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [retrainResult, setRetrainResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    api.getMlStatus().then(setStatus);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRetrain = async () => {
    setLoading(true);
    setRetrainResult(null);
    try {
      const result = await api.retrain();
      setRetrainResult(result);
      loadStatus();
    } catch (e) {
      setRetrainResult({
        error: e instanceof Error ? e.message : "Retrain failed",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!status) return <p className="text-muted-foreground">Loading...</p>;

  const progress = Math.min(
    100,
    (status.training_samples / status.min_samples_required) * 100
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ML Classifier Status</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.is_trained ? (
              <Badge variant="success" className="text-base py-1 px-3">
                Trained
              </Badge>
            ) : (
              <Badge variant="warning" className="text-base py-1 px-3">
                Not Trained
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Training Samples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status.training_samples}</p>
            <p className="text-sm text-muted-foreground">
              {status.min_samples_required} required to train
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Training Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-primary rounded-full h-4 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {status.training_samples} / {status.min_samples_required}{" "}
              samples ({progress.toFixed(0)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manual Retrain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The classifier retrains automatically as you classify transactions.
            You can also trigger a manual retrain here. The model uses TF-IDF
            vectorization with Logistic Regression -- a solid baseline for
            learning text classification fundamentals.
          </p>
          <Button onClick={handleRetrain} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Training..." : "Retrain Now"}
          </Button>

          {retrainResult && (
            <pre className="bg-muted rounded-md p-4 text-sm overflow-auto">
              {JSON.stringify(retrainResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the ML Pipeline Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>1. Text Preprocessing:</strong> Transaction descriptions are
            lowercased, unicode-normalized, and stripped of noise (numbers,
            reference IDs, special characters).
          </p>
          <p>
            <strong>2. TF-IDF Vectorization:</strong> Text is converted to
            numerical vectors using Term Frequency-Inverse Document Frequency.
            This captures which words are important by weighing frequent-in-document
            but rare-across-corpus terms higher.
          </p>
          <p>
            <strong>3. Logistic Regression:</strong> A linear classifier that
            learns a decision boundary for each category. It outputs calibrated
            probability scores, which we use as confidence values.
          </p>
          <p>
            <strong>4. Confidence Thresholds:</strong> Predictions above 85%
            confidence are shown as strong suggestions. Between 50-85% are shown
            as weaker suggestions. Below 50% the system asks for manual
            classification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
