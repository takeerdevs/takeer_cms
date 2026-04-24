import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';

export default function Terms() {
    return (
        <AppLayout>
            <Head title="Terms of Service | Takeer" />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
                <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Platform Purpose</h2>
                    <p className="text-sm leading-7">
                        Takeer is built for content creators, educators, service providers, and businesses selling physical products.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Prohibited Content</h2>
                    <p className="text-sm leading-7">
                        Adult content and political content are not allowed on this platform. We may remove prohibited content and restrict accounts that violate this policy.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Creator Responsibility</h2>
                    <p className="text-sm leading-7">
                        You are responsible for the accuracy, legality, and ownership of content, products, services, files, and links you publish.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-lg font-black">Enforcement</h2>
                    <p className="text-sm leading-7">
                        We may review, limit, remove, or suspend content or accounts for abuse, policy violations, fraud, or harmful activity.
                    </p>
                </section>
            </div>
        </AppLayout>
    );
}
