<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Payments\Drivers\Selcom\SelcomGateway;
use App\Payments\PaymentCallbackProcessor;
use App\Payments\VerifiedPayoutCallbackProcessor;
use App\Services\ProviderEventRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SelcomCallbackController extends Controller
{
    public function payin(
        Request $request,
        SelcomGateway $selcom,
        ProviderEventRecorder $recorder,
        PaymentCallbackProcessor $processor,
    ): JsonResponse {
        if (! $selcom->verifyRawCallback($request)) {
            $event = $selcom->parseCallback($request);
            $recorder->record($request, $event, $request->header('X-Selcom-Signature') !== null || $request->header('Digest') !== null, false);
            return response()->json(['message' => 'Accepted'], 401);
        }

        $event = $selcom->parseVerifiedCallback($request);
        $providerEvent = $recorder->record($request, $event, true, true);
        $processor->processVerifiedEvent($event, $providerEvent);

        return response()->json(['message' => 'Accepted']);
    }

    public function payout(
        Request $request,
        SelcomGateway $selcom,
        ProviderEventRecorder $recorder,
        VerifiedPayoutCallbackProcessor $processor,
    ): JsonResponse {
        if (! $selcom->verifyRawCallback($request)) {
            $event = $selcom->parseCallback($request);
            $recorder->record($request, $event, $request->header('X-Selcom-Signature') !== null || $request->header('Digest') !== null, false);
            return response()->json(['message' => 'Accepted'], 401);
        }

        $event = $selcom->parseVerifiedCallback($request);
        $providerEvent = $recorder->record($request, $event, true, true);
        $processor->process($event, $providerEvent);

        return response()->json(['message' => 'Accepted']);
    }

    public function refund(
        Request $request,
        SelcomGateway $selcom,
        ProviderEventRecorder $recorder,
        VerifiedPayoutCallbackProcessor $processor,
    ): JsonResponse {
        if (! $selcom->verifyRawCallback($request)) {
            $event = $selcom->parseCallback($request);
            $recorder->record($request, $event, $request->headers->has('X-Selcom-Signature') || $request->headers->has('Digest'), false);
            return response()->json(['message' => 'Accepted'], 401);
        }

        $event = $selcom->parseVerifiedCallback($request);
        $providerEvent = $recorder->record($request, $event, true, true);
        $processor->process($event, $providerEvent);

        return response()->json(['message' => 'Accepted']);
    }
}
