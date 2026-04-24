import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';

export default function Privacy() {
    return (
        <AppLayout>
            <Head title="Privacy Policy | Takeer" />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">What We Collect</h2>
                    <p className="text-sm leading-7">
                        We collect account details, merchant profile information, content you upload, and transaction-related records needed to operate the platform.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">How We Use Data</h2>
                    <p className="text-sm leading-7">
                        We use data to provide publishing, selling, payments, access control, moderation, abuse prevention, and customer support.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Safety and Moderation</h2>
                    <p className="text-sm leading-7">
                        We may process reports and moderation signals to enforce policy, including removal of adult or political content that is not permitted on Takeer.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Your Rights</h2>
                    <p className="text-sm leading-7">
                        You can request updates or deletion of account data where applicable by contacting platform support.
                    </p>
                </section>
            </div>
        </AppLayout>
    );
}
