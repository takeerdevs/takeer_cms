<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use App\Support\ServiceTemplateRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $includeInactive = (bool) $request->boolean('include_inactive');

        $categories = ServiceCategory::query()
            ->with(['children' => function ($query) use ($includeInactive) {
                $query
                    ->when(! $includeInactive, fn ($childQuery) => $childQuery->where('is_active', true))
                    ->orderBy('sort_order')
                    ->orderBy('name');
            }])
            ->whereNull('parent_id')
            ->when(! $includeInactive, fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $categories->map(fn (ServiceCategory $category) => $this->serialize($category))->values(),
            'service_templates' => ServiceTemplateRegistry::all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'parent_id' => 'nullable|integer|exists:service_categories,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'option_template' => 'nullable|array',
            'service_template_key' => ['nullable', 'string', Rule::in(ServiceTemplateRegistry::keys())],
            'allowed_template_keys' => 'nullable|array',
            'allowed_template_keys.*' => ['string', Rule::in(ServiceTemplateRegistry::keys())],
            'template_config' => 'nullable|array',
            'template_rules' => 'nullable|array',
            'risk_level' => 'nullable|string|in:standard,elevated,regulated,restricted',
            'required_documents' => 'nullable|array',
            'required_documents.*' => 'string|in:identity,tin,business_license,registration,professional_license,ownership_proof,vehicle_registration,insurance,operating_permit',
            'requires_manual_review' => 'nullable|boolean',
            'payout_hold_days' => 'nullable|integer|min:0|max:60',
            'max_first_quote_amount' => 'nullable|numeric|min:0',
        ]);

        $category = ServiceCategory::create([
            'parent_id' => $validated['parent_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $this->uniqueSlug($validated['name'], $validated['parent_id'] ?? null),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'option_template' => $validated['option_template'] ?? null,
            'service_template_key' => $validated['service_template_key'] ?? null,
            'allowed_template_keys' => $this->normalizeAllowedTemplates($validated['allowed_template_keys'] ?? [], $validated['service_template_key'] ?? null),
            'template_config' => $validated['template_config'] ?? null,
            'template_rules' => $validated['template_rules'] ?? null,
            'risk_level' => $validated['risk_level'] ?? 'standard',
            'required_documents' => $validated['required_documents'] ?? [],
            'requires_manual_review' => (bool) ($validated['requires_manual_review'] ?? false),
            'payout_hold_days' => (int) ($validated['payout_hold_days'] ?? 3),
            'max_first_quote_amount' => $validated['max_first_quote_amount'] ?? null,
        ]);

        return response()->json([
            'message' => 'Service category created.',
            'category' => $this->serialize($category->fresh('children')),
        ], 201);
    }

    public function update(Request $request, ServiceCategory $serviceCategory): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'parent_id' => 'nullable|integer|exists:service_categories,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'option_template' => 'nullable|array',
            'service_template_key' => ['nullable', 'string', Rule::in(ServiceTemplateRegistry::keys())],
            'allowed_template_keys' => 'nullable|array',
            'allowed_template_keys.*' => ['string', Rule::in(ServiceTemplateRegistry::keys())],
            'template_config' => 'nullable|array',
            'template_rules' => 'nullable|array',
            'risk_level' => 'nullable|string|in:standard,elevated,regulated,restricted',
            'required_documents' => 'nullable|array',
            'required_documents.*' => 'string|in:identity,tin,business_license,registration,professional_license,ownership_proof,vehicle_registration,insurance,operating_permit',
            'requires_manual_review' => 'nullable|boolean',
            'payout_hold_days' => 'nullable|integer|min:0|max:60',
            'max_first_quote_amount' => 'nullable|numeric|min:0',
        ]);

        if (array_key_exists('parent_id', $validated) && (int) $validated['parent_id'] === $serviceCategory->id) {
            return response()->json(['message' => 'Service category cannot be its own parent.'], 422);
        }

        $parentId = array_key_exists('parent_id', $validated) ? ($validated['parent_id'] ?? null) : $serviceCategory->parent_id;
        if (array_key_exists('name', $validated)) {
            $validated['slug'] = $this->uniqueSlug($validated['name'], $parentId, $serviceCategory->id);
        }
        if (array_key_exists('allowed_template_keys', $validated) || array_key_exists('service_template_key', $validated)) {
            $validated['allowed_template_keys'] = $this->normalizeAllowedTemplates(
                $validated['allowed_template_keys'] ?? ($serviceCategory->allowed_template_keys ?? []),
                $validated['service_template_key'] ?? $serviceCategory->service_template_key
            );
        }

        $serviceCategory->update($validated);

        return response()->json([
            'message' => 'Service category updated.',
            'category' => $this->serialize($serviceCategory->fresh('children')),
        ]);
    }

    public function destroy(ServiceCategory $serviceCategory): JsonResponse
    {
        $serviceCategory->delete();

        return response()->json(['message' => 'Service category deleted.']);
    }

    private function uniqueSlug(string $name, ?int $parentId, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($parentId ? "{$parentId}-{$name}" : $name);
        $slug = $baseSlug;
        $counter = 2;

        while (
            ServiceCategory::query()
                ->where('slug', $slug)
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function normalizeAllowedTemplates(array $keys, ?string $defaultKey): array
    {
        return ServiceTemplateRegistry::normalizeKeys(array_filter([$defaultKey, ...$keys]));
    }

    private function serialize(ServiceCategory $category): array
    {
        $category->loadMissing('parent');

        return [
            'id' => $category->id,
            'parent_id' => $category->parent_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'is_active' => (bool) $category->is_active,
            'sort_order' => (int) $category->sort_order,
            'option_template' => $category->option_template,
            'service_template_key' => $category->service_template_key,
            'default_template_key' => $category->service_template_key ?: ServiceTemplateRegistry::templateKeyForCategory($category),
            'allowed_template_keys' => $category->allowed_template_keys ?? [],
            'template_config' => $category->template_config,
            'template_rules' => $category->template_rules,
            'risk_level' => $category->risk_level,
            'required_documents' => $category->required_documents ?? [],
            'requires_manual_review' => (bool) $category->requires_manual_review,
            'payout_hold_days' => (int) $category->payout_hold_days,
            'max_first_quote_amount' => $category->max_first_quote_amount !== null ? (float) $category->max_first_quote_amount : null,
            'service_template' => ServiceTemplateRegistry::forCategory($category),
            'allowed_templates' => ServiceTemplateRegistry::allowedForCategory($category),
            'children' => $category->relationLoaded('children')
                ? $category->children->map(fn (ServiceCategory $child) => $this->serialize($child))->values()
                : [],
        ];
    }
}
