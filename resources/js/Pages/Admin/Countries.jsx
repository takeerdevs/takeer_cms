import React, { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, useForm, router, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    Globe,
    Settings,
    Power,
    CheckCircle2,
    XCircle,
    Search,
    Filter,
    ChevronRight,
    MapPin,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AdminCountries({ countries }) {
    const [searchQuery, setSearchQuery] = useState('');


    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.iso_alpha2.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleStatus = (id) => {
        router.post(`/admin/countries/${id}/toggle`, {}, {
            onSuccess: () => toast.success('Country status updated'),
        });
    };


    return (
        <AdminLayout title="Country Management">
            <Head title="Admin Countries | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Globe className="h-6 w-6 text-indigo-700" /> Country Management
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">Manage global availability and country-specific configurations.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name or code..."
                            className="pl-10 h-11 border-slate-200 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="h-11 px-5 rounded-xl border-slate-200 text-slate-600 gap-2">
                        <Filter className="h-4 w-4" /> Filters
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredCountries.map((country) => (
                        <Card key={country.id} className="overflow-hidden border-slate-200 hover:border-indigo-200 transition-colors shadow-sm">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch md:items-center p-5 gap-6">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-inner">
                                            {country.flag || '🏳️'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-slate-900">{country.name}</h3>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wider">
                                                    {country.iso_alpha2}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 font-medium">
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5" /> {country.continent}
                                                </span>
                                                <span>Code: {country.phone_code}</span>
                                                {country.currency && (
                                                    <span className="text-indigo-600 font-bold">{country.currency.code}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                                        <div className="flex flex-col items-end mr-4">
                                            <div className={cn(
                                                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide",
                                                country.is_active
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                    : "bg-slate-100 text-slate-400 border-slate-200"
                                            )}>
                                                {country.is_active ? (
                                                    <><CheckCircle2 className="h-3 w-3" /> Active</>
                                                ) : (
                                                    <><XCircle className="h-3 w-3" /> Disabled</>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/countries/${country.id}/settings`}
                                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 h-10 w-10 text-slate-600 hover:bg-slate-50 transition-colors"
                                            >
                                                <Settings className="h-4 w-4" />
                                            </Link>
                                            <Button
                                                variant={country.is_active ? "ghost" : "outline"}
                                                size="icon"
                                                className={cn(
                                                    "rounded-xl h-10 w-10",
                                                    country.is_active ? "text-red-500 hover:bg-red-50" : "text-emerald-500 border-emerald-100 bg-emerald-50"
                                                )}
                                                onClick={() => toggleStatus(country.id)}
                                            >
                                                <Power className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

