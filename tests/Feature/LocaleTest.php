<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_locale_switch_is_validated_and_persisted_in_session(): void
    {
        $response = $this->postJson('/locale', ['locale' => 'sw']);

        $response
            ->assertOk()
            ->assertJson(['locale' => 'sw']);

        $response->assertSessionHas('user_session_language', 'sw');
    }

    public function test_locale_switch_rejects_unsupported_languages(): void
    {
        $response = $this->postJson('/locale', ['locale' => 'fr']);

        $response->assertStatus(422);
    }

    public function test_versioned_legal_document_uses_the_selected_language(): void
    {
        $response = $this->withSession(['user_session_language' => 'sw'])
            ->get('/legal/buyer-terms');

        $response
            ->assertOk()
            ->assertSee('Masharti ya Mnunuzi');
    }
}
