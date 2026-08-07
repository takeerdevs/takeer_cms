<?php
namespace App\Events;
use App\Models\SocialCommerceRequest;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
class SocialCommerceRequestConverted implements ShouldDispatchAfterCommit { use Dispatchable, SerializesModels; public function __construct(public SocialCommerceRequest $request) {} }
