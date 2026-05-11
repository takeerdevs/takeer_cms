<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class MerchantRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'otp' => ['nullable', 'string', 'size:6'],
            'store_name' => ['nullable', 'string', 'max:255'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'country_id' => ['nullable', 'exists:countries,id'],
            'currency_id' => ['nullable', 'exists:currencies,id'],
            'timezone' => ['nullable', 'timezone'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone_number.required' => 'Nambari ya simu inahitajika.',
            'otp.required' => 'Nambari ya siri inahitajika.',
            'store_name.required' => 'Jina la biashara linahitajika.',
            'display_name.required' => 'Jina la kuonyesha linahitajika.',
        ];
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
