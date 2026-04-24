@extends('errors.layout')

@section('content')
    <span class="badge">TAKEER ERROR</span>
    <div class="code">404</div>
    <h1 class="title">This page is not available.</h1>
    <p class="desc">
        The link may be invalid, moved, or intentionally unavailable. Deleted or restricted content is not publicly accessible.
    </p>
    <div class="actions">
        <a href="/feed" class="btn primary">Go to Feed</a>
        <a href="/welcome" class="btn">Open Welcome</a>
    </div>
@endsection
