import React from 'react';
import { Link } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';

export default function PolicyNotice({ className = '' }) {
    return (
        <div className={`rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 ${className}`}>
            <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900">
                        By publishing, you confirm this content follows Takeer policy and you agree to our{' '}
                        <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>{' '}
                        and{' '}
                        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}
