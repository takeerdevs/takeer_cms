<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="30">
    <title>{{ $service }} Status</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f5f7fb;
            --panel: #ffffff;
            --line: #dfe6f0;
            --text: #111827;
            --muted: #667085;
            --ok: #079455;
            --bad: #d92d20;
            --warn: #dc6803;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        main {
            width: min(1120px, calc(100% - 32px));
            margin: 0 auto;
            padding: 40px 0;
        }

        header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 28px;
        }

        h1 {
            margin: 0;
            font-size: 32px;
            line-height: 1.15;
        }

        .meta {
            margin-top: 8px;
            color: var(--muted);
            font-size: 14px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-height: 44px;
            padding: 0 16px;
            border: 1px solid var(--line);
            border-radius: 999px;
            background: var(--panel);
            font-weight: 800;
        }

        .dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: var(--status-color);
            box-shadow: 0 0 0 5px color-mix(in srgb, var(--status-color) 14%, transparent);
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
        }

        .stat,
        .check {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--panel);
            box-shadow: 0 8px 24px rgba(17, 24, 39, 0.04);
        }

        .stat {
            padding: 18px;
        }

        .label {
            color: var(--muted);
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .value {
            margin-top: 8px;
            font-size: 22px;
            font-weight: 850;
        }

        .checks {
            display: grid;
            gap: 12px;
        }

        .history {
            margin-top: 22px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--panel);
            box-shadow: 0 8px 24px rgba(17, 24, 39, 0.04);
            overflow: hidden;
        }

        .history-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 18px;
            border-bottom: 1px solid var(--line);
        }

        .history-header h2 {
            margin: 0;
            font-size: 18px;
        }

        .status-board {
            display: grid;
        }

        .status-board-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 22px;
            border-bottom: 1px solid var(--line);
        }

        .history-actions {
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        .range-tabs {
            display: inline-flex;
            padding: 3px;
            border: 1px solid var(--line);
            border-radius: 999px;
            background: #f8fafc;
        }

        .range-tab {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 46px;
            min-height: 30px;
            padding: 0 12px;
            border-radius: 999px;
            color: var(--muted);
            font-size: 13px;
            font-weight: 850;
            text-decoration: none;
        }

        .range-tab.is-active {
            background: var(--panel);
            color: var(--text);
            box-shadow: 0 2px 8px rgba(17, 24, 39, 0.08);
        }

        .events {
            display: grid;
            gap: 8px;
            padding: 0 22px 22px;
        }

        .event {
            display: grid;
            grid-template-columns: 148px minmax(0, 1fr);
            gap: 12px;
            align-items: start;
            padding: 11px 12px;
            border: 1px solid #fee4e2;
            border-radius: 8px;
            background: #fff7f5;
            color: #7a271a;
            font-size: 13px;
            font-weight: 650;
        }

        .event-time {
            color: #912018;
            white-space: nowrap;
        }

        .status-board-title {
            display: flex;
            align-items: baseline;
            gap: 14px;
            flex-wrap: wrap;
        }

        .status-board-title h2 {
            margin: 0;
            font-size: 22px;
            line-height: 1.2;
        }

        .range {
            color: var(--muted);
            font-size: 18px;
            font-weight: 600;
        }

        .status-row {
            padding: 22px;
            border-bottom: 1px solid #eef2f7;
        }

        .status-group {
            border-bottom: 1px solid #eef2f7;
        }

        .status-group-header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: center;
            padding: 22px 22px 14px;
        }

        .group-title {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
        }

        .group-title strong {
            font-size: 21px;
        }

        .group-components {
            color: var(--muted);
            font-size: 17px;
            font-weight: 600;
        }

        .group-bars {
            padding: 0 22px 18px;
        }

        .status-group .status-row {
            padding-left: 54px;
        }

        .status-row:last-child {
            border-bottom: 0;
        }

        .status-row-top {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: center;
            margin-bottom: 14px;
        }

        .status-name {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
        }

        .status-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: var(--row-color);
            color: white;
            font-size: 15px;
            font-weight: 900;
            line-height: 1;
            flex: 0 0 auto;
        }

        .status-name strong {
            font-size: 20px;
        }

        .component-count {
            color: var(--muted);
            font-size: 17px;
            font-weight: 600;
        }

        .uptime {
            color: var(--muted);
            font-size: 17px;
            font-weight: 700;
            white-space: nowrap;
        }

        .bars {
            display: grid;
            grid-template-columns: repeat(var(--sample-count), minmax(4px, 1fr));
            gap: 5px;
            align-items: center;
        }

        .bar {
            height: 22px;
            min-width: 4px;
            border-radius: 2px;
            background: var(--bar-color);
            position: relative;
        }

        .bar:hover::before {
            content: attr(data-tip);
            position: absolute;
            z-index: 5;
            left: 50%;
            bottom: calc(100% + 10px);
            transform: translateX(-50%);
            width: max-content;
            max-width: 280px;
            padding: 10px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: white;
            color: var(--text);
            box-shadow: 0 14px 36px rgba(17, 24, 39, 0.14);
            font-size: 13px;
            font-weight: 650;
            line-height: 1.4;
            white-space: normal;
        }

        .bar:hover::after {
            content: "";
            position: absolute;
            z-index: 6;
            left: 50%;
            bottom: calc(100% + 5px);
            transform: translateX(-50%) rotate(45deg);
            width: 10px;
            height: 10px;
            border-right: 1px solid var(--line);
            border-bottom: 1px solid var(--line);
            background: white;
        }

        .history-empty {
            padding: 18px;
            color: var(--muted);
            font-size: 14px;
        }

        .notice {
            margin: 16px 22px 0;
            padding: 14px 16px;
            border: 1px solid #fedf89;
            border-radius: 8px;
            background: #fffbeb;
            color: #92400e;
            font-size: 14px;
            font-weight: 650;
        }

        .check {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 18px;
            padding: 18px;
            align-items: center;
        }

        .check h2 {
            margin: 0;
            font-size: 18px;
        }

        .details {
            margin-top: 8px;
            color: var(--muted);
            font-size: 14px;
            overflow-wrap: anywhere;
        }

        .pill {
            padding: 7px 11px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--check-color) 11%, white);
            color: var(--check-color);
            font-size: 13px;
            font-weight: 850;
            border: 1px solid color-mix(in srgb, var(--check-color) 22%, white);
        }

        footer {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 22px;
            color: var(--muted);
            font-size: 14px;
        }

        a {
            color: #0875be;
            font-weight: 750;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        @media (max-width: 720px) {
            main {
                width: min(100% - 24px, 1120px);
                padding: 24px 0;
            }

            header,
            footer {
                display: block;
            }

            .badge {
                margin-top: 18px;
            }

            .summary {
                grid-template-columns: 1fr;
            }

            .check {
                grid-template-columns: 1fr;
            }

            .status-row-top,
            .status-group-header {
                grid-template-columns: 1fr;
            }

            .status-board-header {
                display: block;
            }

            .history-actions {
                justify-content: flex-start;
                margin-top: 14px;
            }

            .event {
                grid-template-columns: 1fr;
            }

            .uptime {
                font-size: 15px;
            }

            .status-group .status-row {
                padding-left: 22px;
            }
        }
    </style>
</head>
<body>
    @php
        $healthy = $status === 'ok';
        $statusColor = $healthy ? 'var(--ok)' : 'var(--bad)';
    @endphp

    <main>
        <header>
            <div>
                <h1>{{ $service }} Status</h1>
                <div class="meta">Current platform readiness snapshot. Auto-refreshes every 30 seconds.</div>
            </div>
            <div class="badge" style="--status-color: {{ $statusColor }}">
                <span class="dot"></span>
                {{ $healthy ? 'All Systems Operational' : 'Degraded Service' }}
            </div>
        </header>

        <section class="summary" aria-label="Status summary">
            <div class="stat">
                <div class="label">Environment</div>
                <div class="value">{{ $environment }}</div>
            </div>
            <div class="stat">
                <div class="label">Checked At</div>
                <div class="value">{{ \Illuminate\Support\Carbon::parse($timestamp)->timezone(config('app.timezone'))->format('H:i:s') }}</div>
            </div>
            <div class="stat">
                <div class="label">Response Time</div>
                <div class="value">{{ $duration_ms }} ms</div>
            </div>
        </section>

        <section class="checks" aria-label="Dependency checks">
            @foreach ($checks as $name => $check)
                @php
                    $ok = (bool) ($check['ok'] ?? false);
                    $color = $ok ? 'var(--ok)' : 'var(--bad)';
                    $detail = collect($check)
                        ->except(['ok', 'duration_ms'])
                        ->map(fn ($value, $key) => $key . ': ' . (is_scalar($value) ? $value : json_encode($value)))
                        ->implode(' · ');
                @endphp

                <article class="check" style="--check-color: {{ $color }}">
                    <div>
                        <h2>{{ str($name)->headline() }}</h2>
                        <div class="details">
                            {{ $detail ?: 'Ready' }}
                            @if (isset($check['duration_ms']))
                                · {{ $check['duration_ms'] }} ms
                            @endif
                        </div>
                    </div>
                    <div class="pill">{{ $ok ? 'Operational' : 'Unavailable' }}</div>
                </article>
            @endforeach
        </section>

        <section class="history" aria-label="Recent health history">
            <div class="status-board">
                <div class="status-board-header">
                    <div class="status-board-title">
                        <h2>System status</h2>
                        <span class="range">{{ $selected_history_range_label ?? '1h' }} window</span>
                    </div>
                    <div class="history-actions">
                        <nav class="range-tabs" aria-label="History range">
                            @foreach (($history_ranges ?? []) as $rangeKey => $range)
                                <a
                                    class="range-tab {{ ($selected_history_range ?? '1h') === $rangeKey ? 'is-active' : '' }}"
                                    href="{{ request()->fullUrlWithQuery(['range' => $rangeKey]) }}"
                                >{{ $range['label'] }}</a>
                            @endforeach
                        </nav>
                        <div class="label">{{ $history_available ? $snapshots->count() . ' samples' : 'Unavailable' }}</div>
                    </div>
                </div>

                @if ($history_available && $snapshots->isNotEmpty())
                    @php
                        $orderedSnapshots = $snapshots->reverse()->values();
                        $latestSnapshot = $snapshots->first();
                        $monitorIsStale = $latestSnapshot && $latestSnapshot->checked_at->lt(now()->subMinutes(10));
                        $groups = [
                            'Infrastructure' => collect($checks)->keys()->all(),
                        ];
                        $degradedEvents = $orderedSnapshots
                            ->filter(fn ($snapshot) => collect($checks)->keys()->contains(
                                fn ($serviceName) => ! (bool) data_get($snapshot->checks, $serviceName . '.ok', false)
                            ))
                            ->reverse()
                            ->take(6)
                            ->values();
                    @endphp

                    @if ($monitorIsStale)
                        <div class="notice">
                            Health history is stale. Last scheduled sample was {{ $latestSnapshot->checked_at->diffForHumans() }}.
                            Restart the scheduler process or run <strong>php artisan schedule:work</strong>.
                        </div>
                    @endif

                    @foreach ($groups as $groupName => $serviceNames)
                        @php
                            $groupSamples = $orderedSnapshots
                                ->flatMap(fn ($snapshot) => collect($serviceNames)->map(fn ($serviceName) => data_get($snapshot->checks, $serviceName, [])))
                                ->filter();
                            $groupTotal = max(1, $groupSamples->count());
                            $groupHealthy = $groupSamples->filter(fn ($check) => (bool) data_get($check, 'ok', false))->count();
                            $groupUptime = number_format(($groupHealthy / $groupTotal) * 100, 2);
                            $groupCurrentOk = collect($serviceNames)->every(fn ($serviceName) => (bool) data_get($checks, $serviceName . '.ok', false));
                        @endphp

                        <div class="status-group" style="--row-color: {{ $groupCurrentOk ? 'var(--ok)' : 'var(--bad)' }}">
                            <div class="status-group-header">
                                <div class="group-title">
                                    <span class="status-icon">{{ $groupCurrentOk ? '✓' : '!' }}</span>
                                    <strong>{{ $groupName }}</strong>
                                    <span class="group-components">{{ count($serviceNames) }} components</span>
                                </div>
                                <div class="uptime">{{ $groupUptime }}% uptime</div>
                            </div>

                            <div class="group-bars">
                                <div class="bars" style="--sample-count: {{ max(1, $orderedSnapshots->count()) }}">
                                    @foreach ($orderedSnapshots as $snapshot)
                                        @php
                                            $failedServices = collect($serviceNames)
                                                ->filter(fn ($serviceName) => ! (bool) data_get($snapshot->checks, $serviceName . '.ok', false))
                                                ->map(fn ($serviceName) => str($serviceName)->headline()->toString())
                                                ->values();
                                            $slowServices = collect($serviceNames)
                                                ->filter(fn ($serviceName) => (bool) data_get($snapshot->checks, $serviceName . '.ok', false) && (float) data_get($snapshot->checks, $serviceName . '.duration_ms', 0) > 300)
                                                ->map(fn ($serviceName) => str($serviceName)->headline()->toString())
                                                ->values();
                                            $barColor = $failedServices->isNotEmpty() ? 'var(--bad)' : ($slowServices->isNotEmpty() ? 'var(--warn)' : 'var(--ok)');
                                            $message = $failedServices->isNotEmpty()
                                                ? 'Degraded: ' . $failedServices->implode(', ')
                                                : ($slowServices->isNotEmpty() ? 'Slow: ' . $slowServices->implode(', ') : 'No incidents');
                                        @endphp
                                        <div
                                            class="bar"
                                            data-tip="{{ $snapshot->checked_at->timezone(config('app.timezone'))->format('M j, H:i') }} · {{ $groupName }} · {{ $message }}"
                                            style="--bar-color: {{ $barColor }}"
                                        ></div>
                                    @endforeach
                                </div>
                            </div>

                            @foreach ($serviceNames as $serviceName)
                                @php
                                    $serviceSamples = $orderedSnapshots
                                        ->map(fn ($snapshot) => data_get($snapshot->checks, $serviceName, []))
                                        ->filter();
                                    $totalSamples = max(1, $serviceSamples->count());
                                    $healthySamples = $serviceSamples->filter(fn ($check) => (bool) data_get($check, 'ok', false))->count();
                                    $uptime = number_format(($healthySamples / $totalSamples) * 100, 2);
                                    $currentOk = (bool) data_get($checks, $serviceName . '.ok', false);
                                @endphp

                                <div class="status-row" style="--row-color: {{ $currentOk ? 'var(--ok)' : 'var(--bad)' }}">
                                    <div class="status-row-top">
                                        <div class="status-name">
                                            <span class="status-icon">{{ $currentOk ? '✓' : '!' }}</span>
                                            <strong>{{ str($serviceName)->headline() }}</strong>
                                            <span class="component-count">1 component</span>
                                        </div>
                                        <div class="uptime">{{ $uptime }}% uptime</div>
                                    </div>

                                    <div class="bars" style="--sample-count: {{ max(1, $orderedSnapshots->count()) }}">
                                        @foreach ($orderedSnapshots as $snapshot)
                                            @php
                                                $check = data_get($snapshot->checks, $serviceName, []);
                                                $ok = (bool) data_get($check, 'ok', false);
                                                $message = data_get($check, 'message');
                                                $duration = data_get($check, 'duration_ms');
                                                $slow = $ok && (float) $duration > 300;
                                                $barColor = $ok ? ($slow ? 'var(--warn)' : 'var(--ok)') : 'var(--bad)';
                                                $tip = $snapshot->checked_at->timezone(config('app.timezone'))->format('M j, H:i')
                                                    . ' · ' . str($serviceName)->headline()
                                                    . ' · ' . ($ok ? ($slow ? 'Slow' : 'Operational') : 'Degraded')
                                                    . ($message ? ' · ' . $message : '')
                                                    . ($duration ? ' · ' . $duration . ' ms' : '');
                                            @endphp
                                            <div
                                                class="bar"
                                                data-tip="{{ $tip }}"
                                                style="--bar-color: {{ $barColor }}"
                                            ></div>
                                        @endforeach
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @endforeach

                    @if ($degradedEvents->isNotEmpty())
                        <div class="events" aria-label="Recent degraded events">
                            @foreach ($degradedEvents as $event)
                                @php
                                    $failedServices = collect($checks)->keys()
                                        ->filter(fn ($serviceName) => ! (bool) data_get($event->checks, $serviceName . '.ok', false))
                                        ->map(fn ($serviceName) => str($serviceName)->headline()->toString())
                                        ->values();
                                @endphp
                                <div class="event">
                                    <div class="event-time">{{ $event->checked_at->timezone(config('app.timezone'))->format('M j, H:i') }}</div>
                                    <div>Degraded: {{ $failedServices->implode(', ') }}</div>
                                </div>
                            @endforeach
                        </div>
                    @endif
                @else
                    <div class="history-empty">
                        No scheduled health snapshots yet. Run <strong>php artisan health:check</strong>, or keep the scheduler running so it records them every five minutes.
                    </div>
                @endif
            </div>
        </section>

        <footer>
            <div>For monitors and load balancers, use <a href="/health/ready">/health/ready</a> or <a href="/api/health">/api/health</a>.</div>
            <div><a href="/admin/horizon">Open Horizon</a></div>
        </footer>
    </main>
</body>
</html>
