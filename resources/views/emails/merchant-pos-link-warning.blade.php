<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
    <h2 style="margin: 0 0 12px;">Tahadhari kuhusu link ya malipo ya POS</h2>

    <p>Habari {{ $merchantName }},</p>

    <p>
        Mteja ameripoti link ya malipo ya POS {{ $orderPublicId }} na kusema:
        <strong>{{ $customerReport }}</strong>
    </p>

    <p>
        Hatua iliyochukuliwa na Takeer: <strong>{{ $actionLabel }}</strong>.
        Tafadhali tumia link za malipo ya POS kwa madeni halisi tu, ambapo mteja tayari alipokea bidhaa dukani.
    </p>

    @if(!empty($adminNotes))
        <p><strong>Maelezo ya admin:</strong> {{ $adminNotes }}</p>
    @endif

    <p>
        Matumizi mabaya yakijirudia tunaweza kuzima link za malipo ya POS, kusimamisha akaunti,
        au kufunga akaunti kulingana na sheria na masharti ya Takeer.
    </p>

    <p>
        Soma sheria na masharti hapa:
        <a href="{{ url('/terms') }}" style="color: #b45309;">{{ url('/terms') }}</a>
    </p>

    <p>Asante,<br>Takeer Trust & Safety</p>
</div>
