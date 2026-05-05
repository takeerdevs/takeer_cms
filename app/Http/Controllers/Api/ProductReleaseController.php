<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entitlement;
use App\Models\Merchant;
use App\Models\Product;
use App\Models\ProductRelease;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductReleaseController extends Controller
{
    public function index(Request $request, Merchant $merchant, Product $product): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);

        return response()->json([
            'data' => $product->softwareReleases()->get()->map(fn (ProductRelease $release) => $this->releasePayload($release, true))->values(),
        ]);
    }

    public function store(Request $request, Merchant $merchant, Product $product): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        abort_unless($product->isDigital() && ($product->digital_content_type ?? '') === 'software', 422, 'Releases are only available for software/code products.');

        $validated = $request->validate([
            'version' => 'required|string|max:80',
            'title' => 'nullable|string|max:160',
            'changelog' => 'nullable|string|max:8000',
            'file_url' => 'required|string|max:2048',
            'mime' => 'nullable|string|max:255',
            'size' => 'nullable|integer|min:0',
            'status' => 'nullable|string|in:draft,published,deprecated',
            'is_latest' => 'nullable|boolean',
        ]);

        $validated['file_url'] = $this->normalizePrivateUrl($validated['file_url']);
        $validated['status'] = $validated['status'] ?? 'published';
        $validated['published_at'] = $validated['status'] === 'published' ? now() : null;
        $validated['is_latest'] = (bool) ($validated['is_latest'] ?? $validated['status'] === 'published');

        $release = $product->softwareReleases()->create($validated);
        if ($release->is_latest) {
            $this->markLatest($release);
        }

        return response()->json([
            'message' => 'Release imeongezwa.',
            'release' => $this->releasePayload($release->fresh(), true),
        ], 201);
    }

    public function update(Request $request, Merchant $merchant, Product $product, ProductRelease $release): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        abort_unless((int) $release->product_id === (int) $product->id, 404);

        $validated = $request->validate([
            'version' => 'sometimes|required|string|max:80',
            'title' => 'nullable|string|max:160',
            'changelog' => 'nullable|string|max:8000',
            'file_url' => 'sometimes|required|string|max:2048',
            'mime' => 'nullable|string|max:255',
            'size' => 'nullable|integer|min:0',
            'status' => 'nullable|string|in:draft,published,deprecated',
            'is_latest' => 'nullable|boolean',
        ]);

        if (isset($validated['file_url'])) {
            $validated['file_url'] = $this->normalizePrivateUrl($validated['file_url']);
        }
        if (($validated['status'] ?? null) === 'published' && !$release->published_at) {
            $validated['published_at'] = now();
        }

        $release->update($validated);
        if ((bool) ($validated['is_latest'] ?? false)) {
            $this->markLatest($release->fresh());
        }

        return response()->json([
            'message' => 'Release imesasishwa.',
            'release' => $this->releasePayload($release->fresh(), true),
        ]);
    }

    public function destroy(Request $request, Merchant $merchant, Product $product, ProductRelease $release): JsonResponse
    {
        $this->authorizeMerchantProduct($request, $merchant, $product);
        abort_unless((int) $release->product_id === (int) $product->id, 404);
        $release->delete();

        $latest = $product->softwareReleases()->where('status', 'published')->latest('published_at')->latest('id')->first();
        if ($latest) {
            $this->markLatest($latest);
        }

        return response()->json(['message' => 'Release imefutwa.']);
    }

    public function download(Request $request, Product $product, ProductRelease $release)
    {
        abort_unless((int) $release->product_id === (int) $product->id && $release->status === 'published', 404);
        $authorization = $this->authorizeBuyerReleaseAccess($request, $product);
        if ($authorization instanceof JsonResponse) {
            return $authorization;
        }

        $url = (string) $release->file_url;
        [$isPrivateReference, $target] = $this->resolveDigitalTarget($url);
        if (!$url || !$isPrivateReference) {
            abort(404);
        }

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($target)) {
                return redirect()->away($disk->temporaryUrl($target, now()->addMinutes(10), [
                    'ResponseContentDisposition' => 'attachment; filename="' . basename($target) . '"',
                ]));
            }
        } catch (\Throwable) {
            // S3 may not be configured in local development.
        }

        abort_unless(Storage::disk('local')->exists($target), 404);

        return Storage::disk('local')->download($target, basename($target), [
            'Content-Type' => $release->mime ?: Storage::disk('local')->mimeType($target) ?: 'application/octet-stream',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    private function authorizeMerchantProduct(Request $request, Merchant $merchant, Product $product): void
    {
        $user = $request->user();
        abort_unless($user && (int) $merchant->user_id === (int) $user->id, 403);
        abort_unless((int) $product->merchant_id === (int) $merchant->id, 404);
    }

    private function authorizeBuyerReleaseAccess(Request $request, Product $product): JsonResponse|true
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia kwanza.'], 401);
        }

        $product->loadMissing('merchant');
        $isOwner = (int) ($product->merchant?->user_id ?? 0) === (int) $user->id;
        $hasEntitlement = Entitlement::query()
            ->where('user_id', $user->id)
            ->where('item_type', 'product')
            ->where('item_id', $product->id)
            ->where('status', 'active')
            ->exists();

        if (!$isOwner && !$hasEntitlement) {
            return response()->json(['message' => 'Nunua software hii kwanza ili kupakua release.'], 403);
        }

        return true;
    }

    private function markLatest(ProductRelease $release): void
    {
        ProductRelease::query()
            ->where('product_id', $release->product_id)
            ->where('id', '!=', $release->id)
            ->update(['is_latest' => false]);

        $release->forceFill(['is_latest' => true])->save();
    }

    private function releasePayload(ProductRelease $release, bool $includePrivate = false): array
    {
        return [
            'id' => $release->id,
            'version' => $release->version,
            'title' => $release->title,
            'changelog' => $release->changelog,
            'status' => $release->status,
            'is_latest' => (bool) $release->is_latest,
            'published_at' => $release->published_at?->toISOString(),
            'mime' => $release->mime,
            'size' => $release->size,
            'file_url' => $includePrivate ? $release->file_url : null,
        ];
    }

    private function normalizePrivateUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '' || str_starts_with($url, 'private://') || preg_match('/^https?:\/\//i', $url)) {
            return $url;
        }

        return "private://{$url}";
    }

    /**
     * @return array{0: bool, 1: string}
     */
    private function resolveDigitalTarget(string $value): array
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return [false, ''];
        }
        if (str_starts_with($trimmed, 'private://')) {
            return [true, ltrim(str_replace('private://', '', $trimmed), '/')];
        }
        if (preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $trimmed)) {
            return [false, $trimmed];
        }

        return [true, ltrim($trimmed, '/')];
    }
}
