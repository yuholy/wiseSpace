import type { ProviderConfig, Model } from '@/types';

export type EmbeddingReadinessMissingReason =
  | 'no_enabled_provider'
  | 'no_api_key'
  | 'no_embedding_model'
  | 'embedding_model_disabled';

export interface EmbeddingReadiness {
  ready: boolean;
  availableModelCount: number;
  enabledProviderCount: number;
  enabledKeyCount: number;
  missingReasons: EmbeddingReadinessMissingReason[];
}

function isEmbeddingModel(model: Pick<Model, 'model_id' | 'model_type'>) {
  return model.model_type === 'Embedding' || /embed/i.test(model.model_id);
}

export function evaluateEmbeddingReadiness(
  providers: ProviderConfig[],
): EmbeddingReadiness {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const providersWithEnabledKeys = enabledProviders.filter((provider) =>
    provider.keys.some((key) => key.enabled),
  );
  const providersWithEmbeddingModels = providersWithEnabledKeys.filter((provider) =>
    provider.models.some((model) => isEmbeddingModel(model)),
  );
  const availableModels = providersWithEnabledKeys.flatMap((provider) =>
    provider.models.filter((model) => model.enabled && isEmbeddingModel(model)),
  );

  const missingReasons: EmbeddingReadinessMissingReason[] = [];
  if (enabledProviders.length === 0) {
    missingReasons.push('no_enabled_provider');
  }
  if (enabledProviders.length > 0 && providersWithEnabledKeys.length === 0) {
    missingReasons.push('no_api_key');
  }
  if (
    providersWithEnabledKeys.length > 0
    && providersWithEmbeddingModels.length === 0
  ) {
    missingReasons.push('no_embedding_model');
  }
  if (
    providersWithEmbeddingModels.length > 0
    && availableModels.length === 0
  ) {
    missingReasons.push('embedding_model_disabled');
  }

  return {
    ready: availableModels.length > 0,
    availableModelCount: availableModels.length,
    enabledProviderCount: enabledProviders.length,
    enabledKeyCount: providersWithEnabledKeys.reduce(
      (count, provider) => count + provider.keys.filter((key) => key.enabled).length,
      0,
    ),
    missingReasons,
  };
}
