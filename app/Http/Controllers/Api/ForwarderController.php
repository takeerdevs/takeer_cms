<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Forwarder;
use Illuminate\Http\Request;

class ForwarderController extends Controller
{
    public function index()
    {
        return response()->json([
            'forwarders' => Forwarder::with('country')->where('is_verified', true)->get()
        ]);
    }
}
