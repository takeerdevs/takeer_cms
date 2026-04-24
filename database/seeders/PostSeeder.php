<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Post;
use App\Models\PostLike;
use App\Models\User;
use Illuminate\Database\Seeder;

class PostSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::first() ?: User::factory()->create(['name' => 'Takeer User', 'email' => 'user@example.com']);

        // 1. Text Post
        $post1 = Post::create([
            'merchant_id' => $user->id,
            'media_type' => 'text',
            'bg_style' => 'gradient_fire',
            'caption' => 'Karibu Takeer! Jukwaa pekee la kijamii na biashara Afrika. 🔥',
            'like_count' => 150,
            'comment_count' => 2,
        ]);

        // 2. Multi-image post
        $post2 = Post::create([
            'merchant_id' => $user->id,
            'media_type' => 'image',
            'images' => [
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
                'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
                'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800',
            ],
            'caption' => 'Mkusanyiko mpya wa bidhaa za kisasa. Karibuni sana!',
            'like_count' => 89,
            'comment_count' => 1,
        ]);

        // Add some comments
        Comment::create([
            'post_id' => $post1->id,
            'user_id' => $user->id,
            'text' => 'Hii ni hatua kubwa sana!',
        ]);

        $reply = Comment::create([
            'post_id' => $post1->id,
            'user_id' => $user->id,
            'parent_id' => Comment::where('post_id', $post1->id)->first()->id,
            'text' => 'Asante sana! Karibu.',
        ]);

        Comment::create([
            'post_id' => $post2->id,
            'user_id' => $user->id,
            'text' => 'Je, hizi zinapatikana kwa rangi gani?',
        ]);

        // Add some likes
        PostLike::create([
            'post_id' => $post1->id,
            'user_id' => $user->id,
        ]);
    }
}
