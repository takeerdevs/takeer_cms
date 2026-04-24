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
        $phone = $this->input('phone_number');
        $exists = \App\Models\User::where('phone_number', $phone)
            ->where('role', 'merchant')
            ->exists();

        return [
            'phone_number' => ['required', 'string', 'max:20'],
            'otp' => ['required', 'string', 'size:6'],
            'store_name' => [$exists ? 'nullable' : 'required', 'string', 'max:255'],
            'display_name' => [$exists ? 'nullable' : 'required', 'string', 'max:255'],
            'country_id' => ['nullable', 'exists:countries,id'],
            'currency_id' => ['nullable', 'exists:currencies,id'],
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
}
