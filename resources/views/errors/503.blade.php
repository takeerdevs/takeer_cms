@extends('errors.layout')

@section('content')
    <span class="badge">TAKEER ERROR</span>
    <div class="code">503</div>
    <h1 class="title">We’re temporarily unavailable.</h1>
    <p class="desc">
        Takeer is under maintenance right now. Please check back shortly.
    </p>
    <div class="actions">
        <a href="/feed" class="btn primary">Go to Feed</a>
        <a href="javascript:location.reload()" class="btn">Refresh</a>
    </div>
@endsection
