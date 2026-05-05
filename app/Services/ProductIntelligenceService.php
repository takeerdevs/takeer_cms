<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;

class ProductIntelligenceService
{
    /**
     * @var OpenRouterService
     */
    protected $openRouter;

    public function __construct(OpenRouterService $openRouter)
    {
        $this->openRouter = $openRouter;
    }

    /**
     * Feed an uploaded product image to the Vision Model to generate
     * auto-tags, colors, category, and a Swahili description.
     */
    public function analyzeProductImage(string $base64Image): ?array
    {
        $prompt = "You are an expert e-commerce catalog agent for a Tanzanian market called Takeer. 
        Analyze the provided product image and return a STRICT JSON object containing:
        {
            \"category\": \"string (e.g., Viatu, Nguo, Simu)\",
            \"sub_category\": \"string\",
            \"colors\": [\"string\"],
            \"material\": \"string or null\",
            \"style\": \"string or null\",
            \"detected_gender\": \"male, female, unisex, or null\",
            \"safety_attributes\": {
                \"ingredients\": \"string or null\",
                \"usage_directions\": \"string or null\",
                \"cautions\": \"string or null\",
                \"allergens\": [\"string\"],
                \"skin_type\": [\"string\"],
                \"hair_type\": [\"string\"],
                \"expiry_date\": \"YYYY-MM-DD or null\",
                \"batch_number\": \"string or null\",
                \"registration_number\": \"string or null\"
            },
            \"suggested_description_swahili\": \"A catchy, sales-driven 2-sentence description in Swahili\"
        }
        For beauty, health, supplements, food, cosmetics, or personal care products, extract visible label details into safety_attributes. Use null or [] when not visible; do not invent regulatory numbers or dates.
        Only Output the JSON. No markdown ticks.";

        try {
            // Reusing the OpenRouterService visual capabilities
            $messages = [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => $base64Image
                            ]
                        ]
                    ]
                ]
            ];

            $response = $this->openRouter->chatCompletions($messages, 'google/gemini-2.5-flash');

            $content = $response['choices'][0]['message']['content'] ?? '';

            // Clean markdown ticks if the model stubbornly included them
            $content = str_replace(['```json', '```'], '', $content);
            $parsed = json_decode(trim($content), true);

            return $parsed;

        } catch (Exception $e) {
            Log::error('ProductIntelligenceService Failed: ' . $e->getMessage());
            return null;
        }
    }
}
