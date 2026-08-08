<?php

namespace Tests\Unit;

use App\Services\LongFormDocumentService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LongFormDocumentServiceTest extends TestCase
{
    public function test_lexical_documents_are_validated_and_plain_text_is_extracted_without_json_noise(): void
    {
        $body = json_encode([
            'root' => [
                'type' => 'root',
                'children' => [
                    [
                        'type' => 'paragraph',
                        'children' => [
                            ['type' => 'text', 'text' => 'A searchable '],
                            ['type' => 'text', 'text' => 'article'],
                        ],
                    ],
                    [
                        'type' => 'takeer_card',
                        'cardType' => 'callout',
                        'data' => ['text' => 'Important note', 'description' => 'Searchable card description', 'buttonText' => 'Read the guide'],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $service = app(LongFormDocumentService::class);
        $service->assertValid($body);

        $this->assertSame("A searchable article\n\nImportant note Searchable card description Read the guide", $service->plainText($body, 'lexical'));
    }

    public function test_invalid_lexical_documents_are_rejected(): void
    {
        $this->expectException(ValidationException::class);

        app(LongFormDocumentService::class)->assertValid(json_encode([
            'root' => [
                'type' => 'root',
                'children' => [['type' => 'unsupported_block']],
            ],
        ], JSON_THROW_ON_ERROR));
    }
}
