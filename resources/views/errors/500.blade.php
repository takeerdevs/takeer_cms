@extends('errors.layout')

@section('content')
    <span class="badge">TAKEER ERROR</span>
    <div class="code">500</div>
    <h1 class="title">Something went wrong on our side.</h1>
    <p class="desc">
        We’re already looking into it. Please try again in a few moments.
    </p>
    <div class="actions">
        <a href="/feed" class="btn primary">Go to Feed</a>
        <a href="javascript:location.reload()" class="btn">Try Again</a>
    </div>
@endsection
