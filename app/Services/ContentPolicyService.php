<?php

namespace App\Services;

class ContentPolicyService
{
    /**
     * Very lightweight guardrail. This should later be upgraded to ML + admin review workflows.
     */
    public function moderateText(string $text): array
    {
        $normalized = mb_strtolower($text);

        $adultKeywords = ['porn', 'xxx', 'sex video', 'nude', 'onlyfans leaked'];
        $politicalKeywords = ['vote for', 'campaign rally', 'political party', 'election manifesto'];

        foreach ($adultKeywords as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return [
                    'allowed' => false,
                    'status' => 'rejected',
                    'reason' => 'adult_content',
                    'notes' => 'Adult-related language detected.',
                ];
            }
        }

        foreach ($politicalKeywords as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return [
                    'allowed' => false,
                    'status' => 'rejected',
                    'reason' => 'political_content',
                    'notes' => 'Political-related language detected.',
                ];
            }
        }

        return [
            'allowed' => true,
            'status' => 'approved',
            'reason' => null,
            'notes' => null,
        ];
    }
}
