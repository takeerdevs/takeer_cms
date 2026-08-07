<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Search\UnifiedSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request, UnifiedSearchService $search): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:500',
            'query' => 'nullable|string|max:500',
            'mode' => 'nullable|string|in:lexical,hybrid',
            'type' => 'nullable|string|in:all,physical,digital,service,creator,custom',
            'surface' => 'nullable|string|in:all,products',
            'entity_types' => 'nullable|array|max:12',
            'entity_types.*' => 'string|in:merchant,post,content_item,product,service,bundle,subscription_plan,offering_group,forwarder_route',
            'content_types' => 'nullable|array|max:20',
            'content_types.*' => 'string|max:60',
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:12',
            'attributes' => 'nullable|array',
            'category_id' => 'nullable|integer',
            'sub_category_id' => 'nullable|integer',
            'service_category_id' => 'nullable|integer',
            'service_subcategory_id' => 'nullable|integer',
            'service_category' => 'nullable|string|max:120',
            'service_subcategory' => 'nullable|string|max:120',
            'country_id' => 'nullable|integer',
            'merchant_id' => 'nullable|integer',
            'location' => 'nullable|string|max:120',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'radius_km' => 'nullable|numeric|min:1|max:300',
            'available_only' => 'nullable|boolean',
            'in_stock' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        return response()->json($search->search($validated, $request));
    }
}
