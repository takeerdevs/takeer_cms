<?php

namespace App\Events;

use App\Models\Post;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostEngagementUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Post $post,
        public string $type,
    ) {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('posts');
    }

    public function broadcastAs(): string
    {
        return 'post.engagement.updated';
    }

    public function broadcastWith(): array
    {
        $post = $this->post->fresh();

        return [
            'type' => $this->type,
            'post_id' => $post->id,
            'public_id' => $post->public_id,
            'comment_count' => (int) $post->comment_count,
            'reaction_summary' => $post->reactions()
                ->selectRaw('emoji, COUNT(*) as total')
                ->groupBy('emoji')
                ->get()
                ->map(fn ($row) => [
                    'emoji' => $row->emoji,
                    'count' => (int) ($row->total ?? 0),
                ])
                ->values()
                ->all(),
        ];
    }
}
