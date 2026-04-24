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
        $sessionCountry = session('user_session_country');
        $region = $sessionCountry['iso_alpha2'] ?? 'TZ';

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
        ];
    }

    public function messages(): array
    {
        return [];
    }
}
