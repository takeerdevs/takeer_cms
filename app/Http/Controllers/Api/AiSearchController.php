<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductEmbedding;
use App\Services\OpenRouterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AiSearchController extends Controller
{
    public function __construct(private OpenRouterService $ai)
    {
    }

    /**
     * POST /api/search/text
     * Natural Language Search -> Extracted Intent -> SQL/Vector search
     */
    public function textSearch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:500',
        ]);

        $userQuery = $validated['query'];

        try {
            // 1. LLM Extraction using OpenRouter (gemini-2.5-flash)
            $messages = [
                ['role' => 'system', 'content' => 'Extract search intent from the user query. Output ONLY a raw JSON object with these keys: "category" (string or null), "max_price" (integer or null), "colors" (array of strings or null). Example: {"category": "viatu", "max_price": 50000, "colors": ["nyeusi"]}'],
                ['role' => 'user', 'content' => $userQuery]
            ];

            $response = $this->ai->chatCompletions($messages, 'google/gemini-2.5-flash');

            // Clean markdown block if present
            $content = $response['choices'][0]['message']['content'];
            $content = str_replace(['```json', '```'], '', $content);
            $parsedIntent = json_decode(trim($content), true);

            // 2. Query Builder based on parsed intent
            $query = Product::with(['attributes', 'merchant'])->where('in_stock', true);

            if (!empty($parsedIntent['category'])) {
                // Approximate search via Postgres ILIKE on json properties
                $query->whereRaw("attributes->>'category' ILIKE ?", ['%' . $parsedIntent['category'] . '%'])
                    ->orWhere('title', 'ILIKE', '%' . $parsedIntent['category'] . '%');
            }

            if (!empty($parsedIntent['max_price'])) {
                $query->where('price', '<=', $parsedIntent['max_price']);
            }

            $products = $query->take(10)->get();

            return response()->json([
                'ai_reply' => count($products) > 0
                    ? "Hizi hapa bidhaa nilizokutafutia kulingana na ulivyoomba."
                    : "Samahani, sijapata bidhaa yenye vigezo hivyo sasa hivi.",
                'intent_extracted' => $parsedIntent,
                'products' => ProductResource::collection($products)->response()->getData(true)['data'],
            ]);

        } catch (\Exception $e) {
            Log::error('AI Text Search Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Mtandao unasumbua, jaribu tena.'], 500);
        }
    }

    /**
     * POST /api/search/visual
     * Upload Image -> OpenRouter Vision -> Extract Text -> Vector/SQL Search
     */
    public function visualSearch(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|max:10240', // 10MB
        ]);

        try {
            // Convert image to Base64
            $imagePath = $request->file('image')->getRealPath();
            $base64Image = base64_encode(file_get_contents($imagePath));
            $mimeType = $request->file('image')->getMimeType();
            $dataUri = "data:{$mimeType};base64,{$base64Image}";

            // 1. Vision Processing via OpenRouter
            $messages = [
                [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => 'Analyze this product image. Reply ONLY with a comma separated list of 5 descriptive keywords (colors, style, material, category) in Swahili.'],
                        ['type' => 'image_url', 'image_url' => ['url' => $dataUri]]
                    ]
                ]
            ];

            $response = $this->ai->chatCompletions($messages, 'google/gemini-2.5-flash');
            $keywords = explode(',', $response['choices'][0]['message']['content']);
            $keywords = array_map('trim', $keywords);

            // 2. Basic ILIKE matching on keywords (Since we mocked the pgvector `nearestTo` for now)
            $query = Product::with(['attributes', 'merchant'])->where('in_stock', true);
            foreach ($keywords as $keyword) {
                $query->orWhere('title', 'ILIKE', '%' . $keyword . '%')
                    ->orWhereRaw("attributes->>'category' ILIKE ?", ['%' . $keyword . '%']);
            }

            $products = $query->take(8)->get();

            return response()->json([
                'ai_reply' => 'Nimechanganua picha yako. Je, moja ya hizi ndizo unazotafuta?',
                'keywords_extracted' => $keywords,
                'products' => ProductResource::collection($products)->response()->getData(true)['data'],
            ]);

        } catch (\Exception $e) {
            Log::error('AI Visual Search Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindwa kuchambua picha.'], 500);
        }
    }
}
