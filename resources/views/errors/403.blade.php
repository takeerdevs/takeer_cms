@extends('errors.layout')

@section('content')
    <span class="badge">TAKEER ERROR</span>
    <div class="code">403</div>
    <h1 class="title">You don’t have access to this page.</h1>
    <p class="desc">
        This content is private or requires permission. If you purchased access, open it from your Library.
    </p>
    <div class="actions">
        <a href="/orders" class="btn primary">Open Library</a>
        <a href="/feed" class="btn">Go to Feed</a>
    </div>
@endsection
