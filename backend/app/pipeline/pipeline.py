import logging

from app.pipeline.base import (
    ClassificationResult,
    PipelineStage,
    TransactionContext,
)

logger = logging.getLogger(__name__)


class ClassificationPipeline:
    """Sequential classification pipeline.

    Stages are evaluated in order.  The first stage that returns a result
    with sufficient confidence wins.  If no stage succeeds, the transaction
    requires human classification.
    """

    def __init__(self, stages: list[PipelineStage] | None = None) -> None:
        self._stages: list[PipelineStage] = stages or []

    def add_stage(self, stage: PipelineStage) -> None:
        self._stages.append(stage)

    def classify(
        self, ctx: TransactionContext
    ) -> ClassificationResult:
        for stage in self._stages:
            if not stage.enabled:
                continue
            try:
                result = stage.classify(ctx)
                if result is not None and result.is_classified:
                    result.stage_name = stage.name
                    logger.info(
                        "Transaction %s classified by %s (confidence=%.2f)",
                        ctx.transaction_id,
                        stage.name,
                        result.confidence,
                    )
                    return result
            except Exception:
                logger.exception(
                    "Pipeline stage %s failed for transaction %s",
                    stage.name,
                    ctx.transaction_id,
                )

        return ClassificationResult(
            source="unclassified",
            stage_name="none",
        )
