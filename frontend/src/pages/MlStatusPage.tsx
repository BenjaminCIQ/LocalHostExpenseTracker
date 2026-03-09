import { useEffect, useState } from "react";
import { Brain, Clock3, RefreshCw, Target, Zap } from "lucide-react";
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

  const progress =
    status.training_progress_pct ??
    Math.min(100, (status.training_samples / status.min_samples_required) * 100);
  const modelState = status.model_state ?? (status.is_trained ? "trained" : "collecting_data");
  const lastTrainedLabel = status.last_trained_at
    ? new Date(status.last_trained_at).toLocaleString()
    : "Never";
  const accuracyLabel =
    typeof status.current_accuracy === "number"
      ? `${(status.current_accuracy * 100).toFixed(1)}%`
      : "Not available";
  const readinessLabel = status.ready_to_train
    ? "Enough data to train"
    : `${Math.max(0, status.min_samples_required - status.training_samples)} more samples needed`;
  const retrainThreshold = status.retrain_threshold ?? 20;
  const newSinceLastTrain = status.samples_since_last_train ?? 0;
  const retrainProgress = Math.min(100, (newSinceLastTrain / retrainThreshold) * 100);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ML Classifier Status</h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelState === "trained" ? (
              <Badge variant="success" className="text-base py-1 px-3">
                Trained
              </Badge>
            ) : modelState === "stale" ? (
              <Badge variant="warning" className="text-base py-1 px-3">
                Trained (stale)
              </Badge>
            ) : (
              <Badge variant="warning" className="text-base py-1 px-3">
                Collecting Data
              </Badge>
            )}
            <p className="text-sm text-muted-foreground mt-2">{readinessLabel}</p>
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
              {status.is_trained
                ? `Minimum to cold-start: ${status.min_samples_required}`
                : `${status.min_samples_required} required to train`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Last Trained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{lastTrainedLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {status.trained_num_samples ?? 0} samples used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Current Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{accuracyLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cross-validation estimate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {status.is_trained ? "Retrain Freshness" : "Training Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-primary rounded-full h-4 transition-all"
                style={{ width: `${status.is_trained ? retrainProgress : progress}%` }}
              />
            </div>
            {!status.is_trained ? (
              <p className="text-sm text-muted-foreground mt-2">
                {status.training_samples} / {status.min_samples_required}{" "}
                samples ({progress.toFixed(0)}%)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {newSinceLastTrain} / {retrainThreshold} new samples since last train
                {status.needs_retrain
                  ? " - retrain recommended"
                  : ""}
              </p>
            )}
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
