<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LongFormContentUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_merchant_can_upload_a_public_long_form_attachment(): void
    {
        [$user, $merchant] = $this->merchantAccount();

        $response = $this->actingAs($user)->post(
            "/merchant/{$merchant->username}/content/upload/media",
            [
                'merchant_id' => $merchant->id,
                'file' => UploadedFile::fake()->create('field-guide.pdf', 128, 'application/pdf'),
            ],
            ['Accept' => 'application/json'],
        );

        $response->assertOk()
            ->assertJsonPath('name', 'field-guide.pdf')
            ->assertJsonPath('mime', 'application/pdf');

        $this->assertStringContainsString('/storage/content/', (string) $response->json('url'));
        $this->assertCount(1, Storage::disk('public')->allFiles('content'));
    }

    public function test_scoped_long_form_draft_can_autosave_after_an_editor_change(): void
    {
        [$user, $merchant] = $this->merchantAccount();
        $body = $this->lexicalBody('Initial content');

        $created = $this->actingAs($user)->postJson(
            "/merchant/{$merchant->username}/content-items/api",
            [
                'merchant_id' => $merchant->id,
                'title' => 'Upload draft',
                'body' => $body,
                'format' => 'lexical',
                'visibility' => 'draft',
            ],
        )->assertCreated();

        $contentItemId = $created->json('content_item.id');

        $this->actingAs($user)->putJson(
            "/merchant/{$merchant->username}/content-items/{$contentItemId}/api",
            [
                'merchant_id' => $merchant->id,
                'title' => 'Upload draft',
                'body' => $this->lexicalBody('Content with uploaded attachment'),
                'format' => 'lexical',
                'visibility' => 'draft',
            ],
        )->assertOk()
            ->assertJsonPath('content_item.id', $contentItemId);
    }

    private function merchantAccount(): array
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'long-form-author',
            'display_name' => 'Long Form Author',
            'is_default' => true,
            'is_active' => true,
        ]);

        return [$user, $merchant];
    }

    private function lexicalBody(string $text): string
    {
        return json_encode([
            'root' => [
                'children' => [[
                    'children' => [[
                        'detail' => 0,
                        'format' => 0,
                        'mode' => 'normal',
                        'style' => '',
                        'text' => $text,
                        'type' => 'text',
                        'version' => 1,
                    ]],
                    'direction' => null,
                    'format' => '',
                    'indent' => 0,
                    'type' => 'paragraph',
                    'version' => 1,
                ]],
                'direction' => null,
                'format' => '',
                'indent' => 0,
                'type' => 'root',
                'version' => 1,
            ],
        ], JSON_THROW_ON_ERROR);
    }
}
