<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class SendOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public endpoint
    }

    protected function prepareForValidation()
    {
        $region = $this->resolveRegion();

        if ($this->has('phone_number')) {
            $formatted = \App\Services\PhoneService::formatToE164($this->phone_number, $region);
            if ($formatted) {
                $this->merge([
                    'phone_number' => $formatted,
                ]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'phone_number' => ['required', 'string', 'max:20'],
            'country_id' => ['nullable', 'exists:countries,id'],
        ];
    }

    public function messages(): array
    {
        return [];
    }

    private function resolveRegion(): string
    {
        if ($this->filled('country_id')) {
            return \App\Models\Country::whereKey($this->input('country_id'))->value('iso_alpha2') ?: 'TZ';
        }

        $sessionCountry = session('user_session_country');

        return $sessionCountry['iso_alpha2'] ?? 'TZ';
    }
}
