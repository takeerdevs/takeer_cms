<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class LongFormDocumentService
{
    public const FORMAT = 'lexical';

    private const NODE_TYPES = [
        'root', 'paragraph', 'heading', 'quote', 'list', 'listitem',
        'text', 'linebreak', 'link', 'autolink', 'takeer_card',
    ];

    public function assertValid(string $body): void
    {
        $document = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($document)) {
            throw ValidationException::withMessages(['body' => 'The long-form document must be valid Lexical JSON.']);
        }

        $root = $document['root'] ?? null;
        if (! is_array($root) || ($root['type'] ?? null) !== 'root' || ! is_array($root['children'] ?? null)) {
            throw ValidationException::withMessages(['body' => 'The long-form document has an invalid Lexical root.']);
        }

        $this->assertNodeList($root['children']);
    }

    public function plainText(?string $body, ?string $format = null): string
    {
        if (! $body) {
            return '';
        }

        if ($format === self::FORMAT || $this->isLexical($body)) {
            $document = json_decode($body, true);
            if (json_last_error() !== JSON_ERROR_NONE || ! is_array($document)) {
                return '';
            }

            $text = $this->nodeText($document['root'] ?? []);

            return trim((string) preg_replace(['/[^\S\r\n]+/u', '/\n{3,}/u'], [' ', "\n\n"], $text));
        }

        return trim((string) preg_replace('/\s+/u', ' ', strip_tags($body)));
    }

    public function isLexical(?string $body): bool
    {
        if (! $body) {
            return false;
        }

        $document = json_decode($body, true);

        return json_last_error() === JSON_ERROR_NONE
            && is_array($document)
            && ($document['root']['type'] ?? null) === 'root'
            && is_array($document['root']['children'] ?? null);
    }

    private function assertNodeList(array $nodes): void
    {
        foreach ($nodes as $node) {
            if (! is_array($node) || ! in_array($node['type'] ?? null, self::NODE_TYPES, true)) {
                throw ValidationException::withMessages(['body' => 'The long-form document contains an unsupported node.']);
            }

            if (($node['type'] ?? null) === 'text' && ! is_string($node['text'] ?? null)) {
                throw ValidationException::withMessages(['body' => 'Text nodes must contain text.']);
            }

            if (($node['type'] ?? null) === 'takeer_card' && ! is_array($node['data'] ?? null)) {
                throw ValidationException::withMessages(['body' => 'Block cards must contain object data.']);
            }

            if (isset($node['children'])) {
                if (! is_array($node['children'])) {
                    throw ValidationException::withMessages(['body' => 'Lexical node children must be an array.']);
                }
                $this->assertNodeList($node['children']);
            }
        }
    }

    private function nodeText(array $node): string
    {
        $type = $node['type'] ?? null;
        if ($type === 'text') {
            return (string) ($node['text'] ?? '');
        }
        if ($type === 'linebreak') {
            return "\n";
        }
        if ($type === 'takeer_card') {
            $data = is_array($node['data'] ?? null) ? $node['data'] : [];

            return trim(implode(' ', array_filter([
                $data['alt'] ?? null,
                $data['caption'] ?? null,
                $data['title'] ?? null,
                $data['text'] ?? null,
                $data['subheading'] ?? null,
                $data['description'] ?? null,
                $data['content'] ?? null,
                $data['body'] ?? null,
                $data['buttonText'] ?? null,
                $data['provider'] ?? null,
                $data['name'] ?? null,
                $data['url'] ?? null,
            ], fn ($value) => is_scalar($value) && trim((string) $value) !== '')));
        }

        $children = array_map(
            fn ($child) => is_array($child) ? $this->nodeText($child) : '',
            is_array($node['children'] ?? null) ? $node['children'] : []
        );

        $separator = $type === 'root' ? "\n\n" : ($type === 'listitem' ? "\n" : '');

        return trim(implode($separator, array_filter($children, fn ($value) => trim($value) !== '')));
    }
}
