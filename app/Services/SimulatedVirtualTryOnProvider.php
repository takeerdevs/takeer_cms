<?php

namespace App\Services;

use App\Contracts\VirtualTryOnProvider;
use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;

/**
 * Local development adapter. It composites a transparent garment over the
 * portrait so the complete queue/UI flow can be exercised without a vendor.
 * Production should use the HTTP adapter with a real virtual try-on model.
 */
class SimulatedVirtualTryOnProvider implements VirtualTryOnProvider
{
    public function __construct(private readonly TryOnStorageService $storage)
    {
    }

    public function generate(TryOnSession $session, ProductTryOnAsset $asset): TryOnProviderResult
    {
        if (! extension_loaded('imagick')) {
            throw new \RuntimeException('The local try-on adapter requires the Imagick PHP extension.');
        }

        $portrait = new \Imagick();
        $garment = new \Imagick();

        try {
            $portrait->readImageBlob($this->storage->read($session->portrait_disk, $session->portrait_path));
            $garment->readImageBlob($this->storage->read($asset->disk, $asset->garment_path));
            $portrait->setIteratorIndex(0);
            $garment->setIteratorIndex(0);
            $portrait->autoOrient();
            $portrait->setImageFormat('png');
            $garment->setImageFormat('png');

            $targetWidth = max(160, min(1400, (int) round($portrait->getImageWidth() * 0.62)));
            $garment->resizeImage($targetWidth, 0, \Imagick::FILTER_LANCZOS, 1);
            $garment->setImagePage(0, 0, 0, 0);

            $x = max(0, (int) round(($portrait->getImageWidth() - $garment->getImageWidth()) / 2));
            $y = max(0, (int) round($portrait->getImageHeight() * 0.30));
            $portrait->compositeImage($garment, \Imagick::COMPOSITE_OVER, $x, $y);
            $portrait->setImageFormat('jpeg');
            $portrait->setImageCompressionQuality(88);

            return new TryOnProviderResult(
                contents: $portrait->getImageBlob(),
                mimeType: 'image/jpeg',
                metadata: [
                    'mode' => 'simulated_overlay',
                    'notice' => 'Development preview using a garment overlay.',
                ],
            );
        } finally {
            $portrait->clear();
            $portrait->destroy();
            $garment->clear();
            $garment->destroy();
        }
    }
}
