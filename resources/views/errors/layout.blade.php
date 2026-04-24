<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'Takeer' }}</title>
    <style>
        :root {
            --bg-a: #f8fbff;
            --bg-b: #fffdf7;
            --bg-c: #f6fff8;
            --ink: #0f172a;
            --muted: #64748b;
            --brand: #0ea5e9;
            --brand-dark: #0284c7;
            --card: rgba(255,255,255,.9);
            --line: rgba(15, 23, 42, .08);
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; }
        body {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            color: var(--ink);
            background: radial-gradient(1200px 800px at 10% -10%, #dbeafe 0%, transparent 45%),
                        radial-gradient(1000px 700px at 100% 0%, #dcfce7 0%, transparent 40%),
                        linear-gradient(135deg, var(--bg-a), var(--bg-b) 45%, var(--bg-c));
            display: grid;
            place-items: center;
            padding: 20px;
        }
        .shell {
            width: 100%;
            max-width: 760px;
            border: 1px solid var(--line);
            background: var(--card);
            border-radius: 28px;
            box-shadow: 0 20px 70px rgba(15, 23, 42, .08);
            overflow: hidden;
            backdrop-filter: blur(8px);
        }
        .accent {
            height: 6px;
            background: linear-gradient(90deg, #0ea5e9, #22c55e, #06b6d4);
        }
        .inner {
            padding: 36px 24px;
            text-align: center;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 7px 12px;
            font-size: 11px;
            letter-spacing: .08em;
            font-weight: 800;
            color: var(--muted);
            background: #fff;
        }
        .code {
            font-size: clamp(46px, 11vw, 88px);
            line-height: 1;
            margin: 16px 0 10px;
            letter-spacing: -0.03em;
            font-weight: 900;
        }
        .title {
            margin: 0;
            font-size: clamp(20px, 4vw, 34px);
            line-height: 1.15;
            letter-spacing: -0.02em;
            font-weight: 900;
        }
        .desc {
            margin: 12px auto 0;
            max-width: 56ch;
            color: var(--muted);
            font-size: 15px;
            line-height: 1.65;
        }
        .actions {
            margin-top: 24px;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
        }
        .btn {
            text-decoration: none;
            border-radius: 999px;
            padding: 11px 18px;
            font-size: 14px;
            font-weight: 800;
            border: 1px solid var(--line);
            color: var(--ink);
            background: #fff;
        }
        .btn.primary {
            color: #fff;
            border-color: transparent;
            background: linear-gradient(180deg, var(--brand), var(--brand-dark));
        }
    </style>
</head>
<body>
<main class="shell" role="main" aria-live="polite">
    <div class="accent"></div>
    <div class="inner">
        @yield('content')
    </div>
</main>
</body>
</html>
