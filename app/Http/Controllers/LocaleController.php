<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocaleController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'locale' => ['required', 'in:en,sw'],
        ]);

        $request->session()->put('user_session_language', $validated['locale']);

        return response()->json([
            'locale' => $validated['locale'],
        ]);
    }
}

