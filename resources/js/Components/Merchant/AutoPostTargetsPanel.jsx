import React from 'react';

const AUTO_POST_CHANNELS = [
    {
        key: 'takeer',
        label: 'Takeer',
        hint: 'Post to your Takeer feed after publishing.',
        connected: true,
    },
    {
        key: 'instagram',
        label: 'Instagram',
        hint: 'Connect Instagram to enable auto-posting.',
        connected: false,
    },
    {
        key: 'facebook',
        label: 'Facebook',
        hint: 'Connect Facebook to enable auto-posting.',
        connected: false,
    },
    {
        key: 'x',
        label: 'X',
        hint: 'Connect X to enable auto-posting.',
        connected: false,
    },
];

export const defaultAutoPostTargets = {
    takeer: true,
    instagram: false,
    facebook: false,
    x: false,
};

export default function AutoPostTargetsPanel({
    value = defaultAutoPostTargets,
    onChange,
    title = 'Auto post',
    description = 'Choose where this item is posted after publishing. These choices only affect this item.',
}) {
    const targets = { ...defaultAutoPostTargets, ...(value || {}) };

    const toggleTarget = (key) => {
        const channel = AUTO_POST_CHANNELS.find((item) => item.key === key);
        if (!channel?.connected) return;

        onChange?.({
            ...targets,
            [key]: !targets[key],
        });
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">{title}</h3>
                {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {AUTO_POST_CHANNELS.map((channel) => {
                    const checked = Boolean(targets[channel.key]) && channel.connected;

                    return (
                        <button
                            key={channel.key}
                            type="button"
                            disabled={!channel.connected}
                            onClick={() => toggleTarget(channel.key)}
                            className={`min-h-[76px] rounded-xl border px-3 py-3 text-left transition ${
                                channel.connected
                                    ? checked
                                        ? 'border-brand-500 bg-brand-50 text-brand-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'
                                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black">{channel.label}</span>
                                <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}>
                                    <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-4' : ''}`} />
                                </span>
                            </span>
                            <span className="mt-2 block text-[10px] font-semibold leading-snug opacity-80">
                                {channel.connected ? channel.hint : 'Not connected yet.'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
