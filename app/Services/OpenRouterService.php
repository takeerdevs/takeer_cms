<?php

namespace App\Services;

class OpenRouterService
{
    public function __construct(private AiTaskRouter $router)
    {
    }

    /**
     * Compatibility wrapper for callers that still use the old service name.
     * New code should call forTask() so model selection stays in the control
     * plane instead of being embedded in a feature.
     */
    public function chatCompletions(array $messages, ?string $model = null, string $taskKey = 'generic'): array
    {
        return $this->router->chatForTask($messages, $taskKey, $model);
    }

    public function forTask(array $messages, string $taskKey, ?string $model = null, array $options = []): array
    {
        return $this->router->chatForTask($messages, $taskKey, $model, $options);
    }

    public function streamForTask(
        array $messages,
        string $taskKey,
        ?string $model = null,
        array $options = [],
        ?callable $onDelta = null
    ): array {
        return $this->router->streamForTask($messages, $taskKey, $model, $options, $onDelta);
    }
}
